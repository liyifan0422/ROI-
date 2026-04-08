import React, { useState, useEffect } from "react";
import {
  Card,
  Select,
  Button,
  Table,
  Space,
  InputNumber,
  Input,
  Form,
  message,
  Tag,
  Row,
  Col,
  Spin,
  Typography,
  Tooltip,
} from "antd";
import { PlayCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import {
  TableMeta,
  FieldMeta,
  getFields,
  runPivot,
  ValueConfig,
} from "../api";

const { Text } = Typography;

const AGG_OPTIONS = [
  { value: "sum", label: "求和" },
  { value: "mean", label: "平均值" },
  { value: "count", label: "计数" },
  { value: "min", label: "最小值" },
  { value: "max", label: "最大值" },
];

interface Props {
  tables: TableMeta[];
}

const PivotPage: React.FC<Props> = ({ tables }) => {
  const [selectedTable, setSelectedTable] = useState<string>();
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [rows, setRows] = useState<string[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [values, setValues] = useState<ValueConfig[]>([
    { field: "", agg: "sum" },
  ]);
  const [totalCost, setTotalCost] = useState<number>();
  const [roiFormula, setRoiFormula] = useState("(revenue - cost) / cost");
  const [result, setResult] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedTable) return;
    getFields(selectedTable)
      .then((res) => setFields(res.data.fields))
      .catch(() => message.error("获取字段失败"));
  }, [selectedTable]);

  const allFieldOpts = fields.map((f) => ({
    value: f.name,
    label: (
      <span>
        {f.name}{" "}
        <Tag
          color={
            f.type === "numeric"
              ? "blue"
              : f.type === "datetime"
              ? "green"
              : "default"
          }
          style={{ fontSize: 10 }}
        >
          {f.type}
        </Tag>
      </span>
    ),
  }));

  const numericOpts = fields
    .filter((f) => f.type === "numeric")
    .map((f) => ({ value: f.name, label: f.name }));

  const handleRun = async () => {
    if (!selectedTable) return message.warning("请先选择数据表");
    if (!rows.length && !cols.length)
      return message.warning("请至少选择一个行或列维度");
    if (values.some((v) => !v.field))
      return message.warning("请完整配置指标字段");

    setLoading(true);
    try {
      const res = await runPivot({
        table: selectedTable,
        rows,
        columns: cols,
        values,
        total_cost: totalCost,
        roi_formula: totalCost ? roiFormula : undefined,
      });
      setResult(res.data);
    } catch (e: any) {
      message.error(e.response?.data?.error || "分析失败");
    } finally {
      setLoading(false);
    }
  };

  const resultColumns = result?.columns.map((c) => ({
    title: c,
    dataIndex: c,
    key: c,
    ellipsis: true,
    render: (v: unknown) => {
      if (typeof v === "number") {
        if (c === "ROI") return <Text type={v >= 0 ? "success" : "danger"}>{(v * 100).toFixed(1)}%</Text>;
        return v % 1 === 0 ? v.toLocaleString() : v.toFixed(2);
      }
      return String(v ?? "");
    },
  }));

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Card title="透视配置" size="small">
        <Row gutter={[16, 12]}>
          <Col span={24}>
            <Space>
              <Text strong>数据表：</Text>
              <Select
                style={{ width: 220 }}
                placeholder="选择要分析的表"
                value={selectedTable}
                onChange={(v) => {
                  setSelectedTable(v);
                  setRows([]);
                  setCols([]);
                  setValues([{ field: "", agg: "sum" }]);
                  setResult(null);
                }}
                options={tables.map((t) => ({ value: t.name, label: `${t.name} (${t.rows.toLocaleString()} 行)` }))}
              />
            </Space>
          </Col>

          <Col xs={24} md={8}>
            <Text strong>行维度</Text>
            <Select
              mode="multiple"
              style={{ width: "100%", marginTop: 4 }}
              placeholder="拖拽或选择字段"
              value={rows}
              onChange={setRows}
              options={allFieldOpts}
              disabled={!selectedTable}
            />
          </Col>

          <Col xs={24} md={8}>
            <Text strong>列维度（可选）</Text>
            <Select
              mode="multiple"
              style={{ width: "100%", marginTop: 4 }}
              placeholder="可为空"
              value={cols}
              onChange={setCols}
              options={allFieldOpts}
              disabled={!selectedTable}
            />
          </Col>

          <Col xs={24} md={8}>
            <Text strong>指标 / 聚合方式</Text>
            <Space direction="vertical" style={{ width: "100%", marginTop: 4 }}>
              {values.map((v, i) => (
                <Row key={i} gutter={8}>
                  <Col flex="auto">
                    <Select
                      style={{ width: "100%" }}
                      placeholder="选择字段"
                      value={v.field || undefined}
                      onChange={(val) => {
                        const next = [...values];
                        next[i] = { ...next[i], field: val };
                        setValues(next);
                      }}
                      options={numericOpts}
                      disabled={!selectedTable}
                    />
                  </Col>
                  <Col>
                    <Select
                      style={{ width: 90 }}
                      value={v.agg}
                      onChange={(val) => {
                        const next = [...values];
                        next[i] = { ...next[i], agg: val };
                        setValues(next);
                      }}
                      options={AGG_OPTIONS}
                    />
                  </Col>
                  {values.length > 1 && (
                    <Col>
                      <Button
                        size="small"
                        danger
                        onClick={() =>
                          setValues(values.filter((_, j) => j !== i))
                        }
                      >
                        ×
                      </Button>
                    </Col>
                  )}
                </Row>
              ))}
              <Button
                size="small"
                onClick={() => setValues([...values, { field: "", agg: "sum" }])}
              >
                + 添加指标
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title="ROI 计算（可选）" size="small">
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Text>总花费：</Text>
              <InputNumber
                style={{ width: 160 }}
                placeholder="输入总花费金额"
                value={totalCost}
                onChange={(v) => setTotalCost(v ?? undefined)}
                formatter={(v) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                min={0}
              />
            </Space>
          </Col>
          <Col flex="auto">
            <Space>
              <Text>ROI 公式：</Text>
              <Tooltip title="可用变量：revenue（第一个指标字段的值）、cost（总花费）">
                <QuestionCircleOutlined style={{ color: "#999" }} />
              </Tooltip>
              <Input
                style={{ width: 280 }}
                value={roiFormula}
                onChange={(e) => setRoiFormula(e.target.value)}
                placeholder="(revenue - cost) / cost"
                disabled={!totalCost}
              />
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRun}
              loading={loading}
              disabled={!selectedTable}
            >
              运行分析
            </Button>
          </Col>
        </Row>
      </Card>

      {result && (
        <Card
          title={`分析结果（${result.rows.length.toLocaleString()} 行）`}
          size="small"
        >
          <Spin spinning={loading}>
            <Table
              dataSource={result.rows}
              columns={resultColumns}
              size="small"
              scroll={{ x: true }}
              pagination={{ pageSize: 50, showSizeChanger: true }}
              rowKey={(_, i) => String(i)}
            />
          </Spin>
        </Card>
      )}
    </Space>
  );
};

export default PivotPage;
