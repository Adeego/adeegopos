import SaleCard from "@/components/posComps/SaleCard";
import { Inter } from "next/font/google";


const inter = Inter({ subsets: ["latin"] });

export default function Pos() {
  return (
    <main
      className={`p-4 ${inter.className}`}
    >
      <SaleCard />
    </main>
  );
}
