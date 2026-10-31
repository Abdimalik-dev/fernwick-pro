import { createRoot } from "react-dom/client";
import Store from "./Store.jsx";
import Admin from "./Admin.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(location.pathname.startsWith("/admin") ? <Admin /> : <Store />);
