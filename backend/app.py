import os
import json
import uuid
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, session
from flask_cors import CORS

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-prod")
CORS(app, supports_credentials=True)

# In-memory store: session_id -> {table_name: DataFrame}
_store: dict[str, dict[str, pd.DataFrame]] = {}


def get_session_id():
    if "sid" not in session:
        session["sid"] = str(uuid.uuid4())
    return session["sid"]


def get_tables() -> dict[str, pd.DataFrame]:
    return _store.setdefault(get_session_id(), {})


def df_to_json(df: pd.DataFrame) -> list:
    """Convert DataFrame to JSON-serializable list of dicts."""
    return json.loads(df.to_json(orient="records", date_format="iso", force_ascii=False))


# ── File Upload ──────────────────────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def upload():
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files provided"}), 400

    tables = get_tables()
    result = []
    for f in files:
        name = os.path.splitext(f.filename)[0]
        ext = os.path.splitext(f.filename)[1].lower()
        try:
            if ext == ".csv":
                df = pd.read_csv(f, encoding="utf-8-sig")
            elif ext in (".xlsx", ".xls"):
                df = pd.read_excel(f)
            else:
                return jsonify({"error": f"Unsupported file type: {f.filename}"}), 400

            # Deduplicate table name
            base = name
            i = 1
            while name in tables:
                name = f"{base}_{i}"
                i += 1

            tables[name] = df
            result.append({
                "name": name,
                "rows": len(df),
                "columns": list(df.columns),
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({"tables": result})


@app.route("/api/tables", methods=["GET"])
def list_tables():
    tables = get_tables()
    return jsonify({
        "tables": [
            {"name": n, "rows": len(df), "columns": list(df.columns)}
            for n, df in tables.items()
        ]
    })


@app.route("/api/tables/<name>", methods=["DELETE"])
def delete_table(name: str):
    tables = get_tables()
    if name not in tables:
        return jsonify({"error": "Table not found"}), 404
    del tables[name]
    return jsonify({"ok": True})


@app.route("/api/tables/<name>/preview", methods=["GET"])
def preview_table(name: str):
    tables = get_tables()
    if name not in tables:
        return jsonify({"error": "Table not found"}), 404
    df = tables[name].head(100)
    return jsonify({"columns": list(df.columns), "rows": df_to_json(df)})


# ── Join ─────────────────────────────────────────────────────────────────────

@app.route("/api/join", methods=["POST"])
def join_tables():
    """
    Body: {
      "joins": [
        {"left": "tableA", "right": "tableB", "left_on": "id", "right_on": "id", "how": "left"}
      ],
      "result_name": "merged"
    }
    """
    body = request.json or {}
    joins = body.get("joins", [])
    result_name = body.get("result_name", "merged")

    tables = get_tables()

    if not joins:
        return jsonify({"error": "No joins specified"}), 400

    try:
        first = joins[0]
        left_df = tables[first["left"]].copy()
        right_df = tables[first["right"]]
        merged = left_df.merge(
            right_df,
            left_on=first["left_on"],
            right_on=first["right_on"],
            how=first.get("how", "left"),
            suffixes=("", f'_{first["right"]}'),
        )

        for j in joins[1:]:
            right_df = tables[j["right"]]
            merged = merged.merge(
                right_df,
                left_on=j["left_on"],
                right_on=j["right_on"],
                how=j.get("how", "left"),
                suffixes=("", f'_{j["right"]}'),
            )

        # Deduplicate result name
        base = result_name
        i = 1
        while result_name in tables:
            result_name = f"{base}_{i}"
            i += 1

        tables[result_name] = merged
        return jsonify({
            "name": result_name,
            "rows": len(merged),
            "columns": list(merged.columns),
        })
    except KeyError as e:
        return jsonify({"error": f"Table not found: {e}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Pivot ─────────────────────────────────────────────────────────────────────

@app.route("/api/pivot", methods=["POST"])
def pivot():
    """
    Body: {
      "table": "merged",
      "rows": ["渠道"],
      "columns": ["日期"],          // optional
      "values": [{"field": "收入", "agg": "sum"}],
      "total_cost": 10000,          // optional, for ROI
      "roi_formula": "(revenue - cost) / cost"  // optional
    }
    """
    body = request.json or {}
    table_name = body.get("table")
    rows = body.get("rows", [])
    cols = body.get("columns", [])
    values = body.get("values", [])
    total_cost = body.get("total_cost")
    roi_formula = body.get("roi_formula", "")

    tables = get_tables()
    if table_name not in tables:
        return jsonify({"error": "Table not found"}), 404

    df = tables[table_name].copy()

    if not rows and not cols:
        return jsonify({"error": "At least one row or column dimension required"}), 400
    if not values:
        return jsonify({"error": "At least one value field required"}), 400

    try:
        agg_dict = {}
        for v in values:
            field = v["field"]
            agg = v.get("agg", "sum")
            agg_dict[field] = agg

        group_keys = rows + (cols if cols else [])
        grouped = df.groupby(group_keys).agg(agg_dict).reset_index()
        grouped.columns = [
            c if isinstance(c, str) else "_".join(c) for c in grouped.columns
        ]

        # ROI calculation
        if total_cost is not None and roi_formula:
            try:
                revenue_field = values[0]["field"] if values else None
                local_vars = {
                    "revenue": grouped[revenue_field] if revenue_field else 0,
                    "cost": float(total_cost),
                }
                grouped["ROI"] = eval(roi_formula, {"__builtins__": {}}, local_vars)  # noqa: S307
            except Exception as e:
                grouped["ROI_error"] = str(e)

        return jsonify({
            "columns": list(grouped.columns),
            "rows": df_to_json(grouped),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Trend ─────────────────────────────────────────────────────────────────────

@app.route("/api/trend", methods=["POST"])
def trend():
    """
    Body: {
      "table": "merged",
      "date_field": "日期",
      "metric_field": "收入",
      "agg": "sum",
      "dimension_field": "渠道",      // optional, for grouping lines
      "dimension_values": ["抖音", "快手"],  // optional filter
      "date_start": "2024-01-01",    // optional
      "date_end":   "2024-03-31"     // optional
    }
    """
    body = request.json or {}
    table_name = body.get("table")
    date_field = body.get("date_field")
    metric_field = body.get("metric_field")
    agg = body.get("agg", "sum")
    dim_field = body.get("dimension_field")
    dim_values = body.get("dimension_values")
    date_start = body.get("date_start")
    date_end = body.get("date_end")

    tables = get_tables()
    if table_name not in tables:
        return jsonify({"error": "Table not found"}), 404

    df = tables[table_name].copy()

    try:
        df[date_field] = pd.to_datetime(df[date_field], errors="coerce")
        df = df.dropna(subset=[date_field])

        if date_start:
            df = df[df[date_field] >= pd.to_datetime(date_start)]
        if date_end:
            df = df[df[date_field] <= pd.to_datetime(date_end)]

        if dim_values and dim_field:
            df = df[df[dim_field].isin(dim_values)]

        group_keys = [date_field] + ([dim_field] if dim_field else [])
        grouped = df.groupby(group_keys)[metric_field].agg(agg).reset_index()
        grouped[date_field] = grouped[date_field].dt.strftime("%Y-%m-%d")

        # Build series: [{name, data: [{date, value}]}]
        if dim_field:
            series = []
            for val, grp in grouped.groupby(dim_field):
                series.append({
                    "name": str(val),
                    "data": [
                        {"date": row[date_field], "value": row[metric_field]}
                        for _, row in grp.iterrows()
                    ],
                })
        else:
            series = [{
                "name": metric_field,
                "data": [
                    {"date": row[date_field], "value": row[metric_field]}
                    for _, row in grouped.iterrows()
                ],
            }]

        return jsonify({"series": series})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Field info ────────────────────────────────────────────────────────────────

@app.route("/api/tables/<name>/fields", methods=["GET"])
def table_fields(name: str):
    """Return field names with inferred types (numeric / datetime / string)."""
    tables = get_tables()
    if name not in tables:
        return jsonify({"error": "Table not found"}), 404
    df = tables[name]
    fields = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        if "int" in dtype or "float" in dtype:
            kind = "numeric"
        elif "datetime" in dtype:
            kind = "datetime"
        else:
            # Try to parse as datetime
            try:
                pd.to_datetime(df[col].dropna().head(5), errors="raise")
                kind = "datetime"
            except Exception:
                kind = "string"
        fields.append({"name": col, "type": kind})
    return jsonify({"fields": fields})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
