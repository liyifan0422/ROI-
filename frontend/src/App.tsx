import React, { useState } from "react";
import { Layout, Menu, ConfigProvider, theme } from "antd";
import {
  DatabaseOutlined,
  TableOutlined,
  LineChartOutlined,
} from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import DataPage from "./pages/DataPage";
import PivotPage from "./pages/PivotPage";
import TrendPage from "./pages/TrendPage";
import { TableMeta } from "./api";

const { Sider, Content } = Layout;

const App: React.FC = () => {
  const [page, setPage] = useState("data");
  const [tables, setTables] = useState<TableMeta[]>([]);

  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm }}>
      <Layout style={{ minHeight: "100vh" }}>
        <Sider width={200} theme="dark">
          <div
            style={{
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              padding: "20px 24px 12px",
              letterSpacing: 1,
            }}
          >
            数据透视工具
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[page]}
            onClick={(e) => setPage(e.key)}
            items={[
              { key: "data", icon: <DatabaseOutlined />, label: "数据管理" },
              { key: "pivot", icon: <TableOutlined />, label: "透视分析" },
              { key: "trend", icon: <LineChartOutlined />, label: "趋势分析" },
            ]}
          />
        </Sider>
        <Content style={{ padding: 24, background: "#f5f6fa" }}>
          {page === "data" && (
            <DataPage tables={tables} setTables={setTables} />
          )}
          {page === "pivot" && <PivotPage tables={tables} />}
          {page === "trend" && <TrendPage tables={tables} />}
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
