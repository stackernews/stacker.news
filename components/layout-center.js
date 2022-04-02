import Layout from "./layout";
import styles from "./layout-center.module.css";

export default function LayoutCenter({ children, noFooterLinks, ...props }) {
  return (
    <div className={styles.page}>
      {noFooterLinks ? (
        <Layout noContain noFooterLinks {...props}>
          <div className={styles.content}>{children}</div>
        </Layout>
      ) : (
        <Layout noContain {...props}>
          <div className={styles.content}>{children}</div>
        </Layout>
      )}
    </div>
  );
}
