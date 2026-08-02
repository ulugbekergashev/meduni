import { useParams } from "react-router-dom";
import { MistakesMap } from "./MistakesMap";

/**
 * "Xatolar" tabi — guruh xatolari xaritasi (Modul 28).
 *
 * 2026-08-02: ilgari bu modul `ProgressTab` ICHIDA, heatmapdan keyin inline
 * chizilardi — bitta tabda ikkita to'liq analitika moduli (5 stat karta +
 * talaba×mavzu jadvali + 3 qavat akkordeon) turardi. Endi alohida route:
 * linki bor, orqaga tugmasi ishlaydi.
 */
export function MistakesTab() {
  const { id } = useParams();
  return <MistakesMap courseId={Number(id)} />;
}
