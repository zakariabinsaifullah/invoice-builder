import { StylePicker } from "@/components/style-picker";
import { Card } from "./card";
import { useEditor } from "./store";

export function StyleCard() {
  const style = useEditor((s) => s.invoice.style);
  const set = useEditor((s) => s.set);
  return (
    <Card label="style">
      <StylePicker layout={style.layout} accent={style.accent} onChange={(v) => set("style", { ...style, ...v })} />
    </Card>
  );
}
