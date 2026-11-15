import { createRoot } from "react-dom/client";
import "./style.css";

const root = createRoot(document.getElementById("root")!);
if (import.meta.env.DEV && (import.meta.env.MODE === "appearance" || new URLSearchParams(location.search).get("appearance") === "1")) {
  const { CharacterCreatorScreen } = await import("./components/character/CharacterCreatorScreen");
  root.render(<main><CharacterCreatorScreen appearancePreview/></main>);
} else {
  const { App } = await import("./App");
  root.render(<App/>);
}
