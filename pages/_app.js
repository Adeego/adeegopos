// import Realm from "realm";
import "@/styles/globals.css";
import Sidebar from "@/components/sidebar";

export default function App({ Component, pageProps }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="p-4 flex-1 bg-muted/50">
        <Component {...pageProps} />
      </div>
    </div>
  );
}
