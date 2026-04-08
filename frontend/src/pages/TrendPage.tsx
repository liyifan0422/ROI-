import React, { useState, useEffect } from "react";
import {
  Card,
  Select,
  Button,
  Space,
  Row,
  Col,
  DatePicker,
  Typography,
  message,
  Spin,
  Empty,
} from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TableMeta, FieldMeta, getFields, runTrend } from "../api";

const { Text } = Typography;
const { RangePicker } = DatePicker;

const COLORS = [
  "#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de",
  "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc",
];

interface Props {
  tables: TableMeta[];
}

interface TrendSeries {
  name: string;
  data: { date: string; value: number }[];
}

const TrendPage: React.FC<Props> = ({ tables }) => {
  const [selectedTable, setSelectedTable] = useState<string>();
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [dateField, setDateField] = useState<string>();
  const [metricField, setMetricField] = useState<string>();
  const [agg, setAgg] = useState("sum");
  const [dimField, setDimField] = useState<string>();
  const [dimValues, setDimValues] = useState<string[]>([]);
  const [dimOptions, setDimOptions] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [series, setSeries] = useState<TrendSeries[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedTable) return;
    setFields([]);
    setDateField(undefined);
    setMetricField(undefined);
    setDimField(undefined);
    setDimValues([]);
    setSeries([]);
    getFields(selectedTable)
      .then((res) => setFields(res.data.fields))
      .catch(() => message.error("获取字段失败"));
  }, [selectedTable]);

  // When dimension field changes, load unique values for filter
  useEffect(() => {
    if (!dimField || !selectedTable) {
      setDimOptions([]);
      setDimValues([]);
      return;
    }
    // Fetch preview and extract unique values for dimension
    import("../api").then(({ previewTable }) => {
      previewTable(selectedTable)
        .then((res) => {
          const uniq = Array.from(
            new Set(res.data.rows.map((r) => String(r[dimField!] ?? "")))
          ).filter(Boolean);
          setDimOptions(uniq);
          setDimValues(uniq); // default: select all
        })
        .catch(() => {});
    });
  }, [dimField, selectedTable]);

  const dateOpts = fields
    .filter((f) => f.type === "datetime")
    .map((f) => ({ value: f.name, label: f.name }));

  const numericOpts = fields
    .filter((f) => f.type === "numeric")
    .map((f) => ({ value: f.name, label: f.name }));

  const stringOpts = fields
    .filter((f) => f.type === "string")
    .map((f) => ({ value: f.name, label: f.name }));

  const handleRun = async () => {
    if (!selectedTable) return message.warning("请选择数据表");
    if (!dateField) return message.warning("请选择日期字段");
    if (!metricField) return message.warning("请选择指标字段");

    setLoading(true);
    try {
      const res = await runTrend({
        table: selectedTable,
        date_field: dateField,
        metric_field: metricField,
        agg,
        dimension_field: dimField,
        dimension_values: dimField && dimValues.length ? dimValues : undefined,
        date_start: dateRange?.[0]?.format("YYYY-MM-DD"),
        date_end: dateRange?.[1]?.format("YYYY-MM-DD"),
      });
      setSeries(res.data.series);
    } catch (e: any) {
      message.error(e.response?.data?.error || "查询失败");
    } finally {
      setLoading(false);
    }
  };

  // Merge all series into a single array keyed by date for recharts
  const chartData = React.useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    series.forEach((s) => {
      s.data.forEach(({ date, value }) => {
        if (!map[date]) map[date] = {};
        map[date][s.name] = value;
      });
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [series]);

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Card title="趋势配置" size="small">
        <Row gutter={[16, 12]}>
          <Col xs={24} md={6}>
            <Text strong>数据表</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              placeholder="选择表"
              value={selectedTable}
              onChange={setSelectedTable}
              options={tables.map((t) => ({ value: t.name, label: t.name }))}
            />
          </Col>

          <Col xs={12} md={4}>
            <Text strong>日期字段</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              placeholder="日期"
              value={dateField}
              onChange={setDateField}
              options={dateOpts}
              disabled={!selectedTable}
            />
          </Col>

          <Col xs={12} md={4}>
            <Text strong>指标字段</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              placeholder="指标"
              value={metricField}
              onChange={setMetricField}
              options={numericOpts}
              disabled={!selectedTable}
            />
          </Col>

          <Col xs={12} md={3}>
            <Text strong>聚合方式</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              value={agg}
              onChange={setAgg}
              options={[
                { value: "sum", label: "求和" },
                { value: "mean", label: "平均" },
                { value: "count", label: "计数" },
              ]}
            />
          </Col>

          <Col xs={24} md={7}>
            <Text strong>日期范围（可选）</Text>
            <RangePicker
              style={{ width: "100%", marginTop: 4 }}
              value={dateRange}
              onChange={(v) => setDateRange(v as any)}
            />
          </Col>
        </Row>

        <Row gutter={[16, 12]} style={{ marginTop: 12 }}>
          <Col xs={24} md={6}>
            <Text strong>分组维度（可选）</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              placeholder="按此字段分多条线"
              value={dimField}
              onChange={(v) => {
                setDimField(v);
                setDimValues([]);
              }}
              allowClear
              options={stringOpts}
              disabled={!selectedTable}
            />
          </Col>

          {dimField && dimOptions.length > 0 && (
            <Col xs={24} md={14}>
              <Text strong>
                选择{dimField}（多选，默认全选）
              </Text>
              <Select
                mode="multiple"
                style={{ width: "100%", marginTop: 4 }}
                value={dimValues}
                onChange={setDimValues}
                options={dimOptions.map((v) => ({ value: v, label: v }))}
                maxTagCount={6}
              />
            </Col>
          )}

          <Col>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRun}
              loading={loading}
              disabled={!selectedTable}
              style={{ marginTop: 22 }}
            >
              生成趋势图
            </Button>
          </Col>
        </Row>
      </Card>

      <Card title="趋势图" size="small">
        <Spin spinning={loading}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : v >= 1000
                      ? `${(v / 1000).toFixed(1)}K`
                      : v
                  }
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    typeof value === "number" ? value.toLocaleString() : value,
                    name,
                  ]}
                />
                <Legend />
                {series.map((s, i) => (
                  <Line
                    key={s.name}
                    type="monotone"
                    dataKey={s.name}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="配置参数后点击「生成趋势图」" />
          )}
        </Spin>
      </Card>
    </Space>
  );
};

export default TrendPage;
