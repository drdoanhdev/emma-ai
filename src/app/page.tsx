import TalkButton from "@/components/TalkButton";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Emma</h1>
      <TalkButton />
    </main>
  );
}
