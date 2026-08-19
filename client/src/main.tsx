import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el contenedor raíz de SIGES.");

createRoot(root).render(<App />);
