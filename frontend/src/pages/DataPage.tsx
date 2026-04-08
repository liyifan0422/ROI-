import React, { useState } from "react";
import {
  Card,
  Upload,
  Button,
  Table,
  Select,
  Space,
  Tag,
  Modal,
  Form,
  message,
  Popconfirm,
  Typography,
  Divider,
  Row,
  Col,
} from "antd";
import {
  UploadOutlined,
  LinkOutlined,
  DeleteOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd";
import {
  TableMeta,
  uploadFiles,
  listTables,
  deleteTable,
  previewTable,
  joinTables,
  JoinConfig,
} from "../api";

const { Text } = Typography;

interface Props {
  tables: TableMeta[];
  setTables: (t: TableMeta[]) => void;
}

const HOW_OPTIONS = [
  { value: "left", label: "Left Join（保留左表全部）" },
  { value: "inner", label: "Inner Join（取交集）" },
  { value: "outer", label: "Outer Join（取并集）" },
  { value: "right", label: "Right Join（保留右表全部）" },
];

const DataPage: React.FC<Props> = ({ tables, setTables }) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
  } | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [joinModal, setJoinModal] = useState(false);
  const [joinForm] = Form.useForm();
  const [joining, setJoining] = useState(false);

  const refreshTables = async () => {
    const res = await listTables();
    setTables(res.data.tables);
  };

  const handleUpload = async () => {
    const files = fileList.map((f) => f.originFileObj as File);
    if (!files.length) return;
    setUploading(true);
    try {
      await uploadFiles(files);
      await refreshTables();
      setFileList([]);
      message.success("上传成功");
    } catch (e: any) {
      message.error(e.response?.data?.error || "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteTable(name);
      await refreshTables();
      message.success(`已删除 ${name}`);
    } catch {
      message.error("删除失败");
    }
  };

  const handlePreview = async (name: string) => {
    try {
      const res = await previewTable(name);
      setPreviewData(res.data);
      setPreviewName(name);
    } catch {
      message.error("预览失败");
    }
  };

  const handleJoin = async (values: any) => {
    setJoining(true);
    try {
      const join: JoinConfig = {
        left: values.left,
        right: values.right,
        left_on: values.left_on,
        right_on: values.right_on,
        how: values.how,
      };
      const res = await joinTables([join], values.result_name || "merged");
      await refreshTables();
      setJoinModal(false);
      joinForm.resetFields();
      message.success(`关联成功，生成表：${res.data.name}（${res.data.rows} 行）`);
    } catch (e: any) {
      message.error(e.response?.data?.error || "关联失败");
    } finally {
      setJoining(false);
    }
  };

  const tableColumns = [
    { title: "表名", dataIndex: "name", key: "name" },
    {
      title: "行数",
      dataIndex: "rows",
      key: "rows",
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: "字段",
      dataIndex: "columns",
      key: "columns",
      render: (cols: string[]) => (
        <Space wrap>
          {cols.slice(0, 8).map((c) => (
            <Tag key={c}>{c}</Tag>
          ))}
          {cols.length > 8 && <Tag>+{cols.length - 8} 更多</Tag>}
        </Space>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_: any, record: TableMeta) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record.name)}
          />
          <Popconfirm
            title="确认删除？"
            onConfirm={() => handleDelete(record.name)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const leftTable = Form.useWatch("left", joinForm);
  const rightTable = Form.useWatch("right", joinForm);
  const leftCols =
    tables.find((t) => t.name === leftTable)?.columns.map((c) => ({
      value: c,
      label: c,
    })) || [];
  const rightCols =
    tables.find((t) => t.name === rightTable)?.columns.map((c) => ({
      value: c,
      label: c,
    })) || [];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Card title="上传文件" size="small">
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Upload
              multiple
              accept=".csv,.xlsx,.xls"
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl)}
            >
              <Button icon={<UploadOutlined />}>选择文件（CSV / Excel）</Button>
            </Upload>
          </Col>
          <Col>
            <Button
              type="primary"
              loading={uploading}
              disabled={!fileList.length}
              onClick={handleUpload}
            >
              开始上传
            </Button>
          </Col>
        </Row>
      </Card>

      <Card
        title={`已加载的表（${tables.length}）`}
        size="small"
        extra={
          tables.length >= 2 && (
            <Button
              icon={<LinkOutlined />}
              size="small"
              onClick={() => setJoinModal(true)}
            >
              关联表
            </Button>
          )
        }
      >
        <Table
          dataSource={tables}
          columns={tableColumns}
          rowKey="name"
          size="small"
          pagination={false}
          locale={{ emptyText: "暂无数据，请先上传文件" }}
        />
      </Card>

      {/* Preview Modal */}
      <Modal
        open={!!previewData}
        title={`预览：${previewName}（前 100 行）`}
        onCancel={() => setPreviewData(null)}
        footer={null}
        width="80%"
      >
        {previewData && (
          <Table
            dataSource={previewData.rows}
            columns={previewData.columns.map((c) => ({
              title: c,
              dataIndex: c,
              key: c,
              ellipsis: true,
              width: 120,
            }))}
            size="small"
            scroll={{ x: true, y: 400 }}
            pagination={false}
            rowKey={(_, i) => String(i)}
          />
        )}
      </Modal>

      {/* Join Modal */}
      <Modal
        open={joinModal}
        title="关联两张表"
        onCancel={() => setJoinModal(false)}
        onOk={() => joinForm.submit()}
        confirmLoading={joining}
        okText="生成关联表"
      >
        <Form form={joinForm} layout="vertical" onFinish={handleJoin}>
          <Divider orientation="left" plain>
            左表
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="left" label="选择左表" rules={[{ required: true }]}>
                <Select
                  options={tables.map((t) => ({ value: t.name, label: t.name }))}
                  placeholder="左表"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="left_on"
                label="关联键（左）"
                rules={[{ required: true }]}
              >
                <Select options={leftCols} placeholder="字段" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            右表
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="right" label="选择右表" rules={[{ required: true }]}>
                <Select
                  options={tables
                    .filter((t) => t.name !== leftTable)
                    .map((t) => ({ value: t.name, label: t.name }))}
                  placeholder="右表"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="right_on"
                label="关联键（右）"
                rules={[{ required: true }]}
              >
                <Select options={rightCols} placeholder="字段" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="how" label="关联方式" initialValue="left">
                <Select options={HOW_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="result_name" label="结果表名">
                <Select
                  mode="tags"
                  maxCount={1}
                  placeholder="merged（可自定义）"
                  tokenSeparators={[","]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
};

export default DataPage;
