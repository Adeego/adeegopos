// import Realm from "realm";
import "@/styles/globals.css";
import Sidebar from "@/components/sidebar";

export default function App({ Component, pageProps }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="p-6 flex-1">
        <Component {...pageProps} />
      </div>
    </div>
  );
}
