import { useParams } from "react-router-dom";
import { TopicListSection } from "../topics/TopicListSection";

/** Kurs karkasining "Mavzular" tabi — ro'yxat umumiy komponentda (fan sahifasi
 *  bilan bir xil), bu yerda faqat kurs qamrovi beriladi. */
export function TopicsTab() {
  const { id } = useParams();
  return <TopicListSection scope={{ courseId: Number(id) }} />;
}
