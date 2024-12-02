import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation'
import WsDropdownMenu from "./wholesalerComps/wsDropdownMenu";
import useStaffStore from "../stores/staffStore";

// Icons
import {
  BadgeDollarSign,
  ChartLine,
  Cable,
  PanelLeft,
  Home,
  ShoppingBag,
  ShoppingCart,
  UsersRound,
  LogIn,
  BriefcaseBusiness,
  Settings,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

const links = [
  {
    label: "Home",
    icon: <Home className="h-[18px] w-[18px]" strokeWidth={2} />,
    pageLink: "/dashboard",
    allowedRoles: ["admin", "operator"], // Everyone can access home
  },
  {
    label: "Staff",
    icon: <BriefcaseBusiness className="h-[18px] w-[18px]" strokeWidth={2} />,
    pageLink: "/staff",
    allowedRoles: ["admin"], // Only admin can manage staff
  },
  {
    label: "Products",
    icon: <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={2} />,
    pageLink: "/product",
    allowedRoles: ["admin", "operator"], // admin and operator can manage products
  },
  {
    label: "Sale",
    icon: <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={2} />,
    pageLink: "/",
    allowedRoles: ["admin", "worker", "operator"], // Everyone can access sales
  },
  {
    label: "Customers",
    icon: <UsersRound className="h-[18px] w-[18px]" strokeWidth={2} />,
    pageLink: "/customers",
    allowedRoles: ["admin", "worker", "operator"], // admin and operator can manage customers
  },
  {
    label: "Suppliers",
    icon: <Cable className="h-[18px] w-[18px]" strokeWidth={2} />,
    pageLink: "/supplier",
    allowedRoles: ["admin", "operator"], // admin and operator can manage suppliers
  },
  {
    label: "Finance",
    icon: <BadgeDollarSign className="h-[18px] w-[18px]" strokeWidth={2} />,
    pageLink: "/finance",
    allowedRoles: ["admin"], // Only admin can access finance
  },
  {
    label: "Report",
    icon: <ChartLine className="h-[18px] w-[18px]" strokeWidth={2} />,
    pageLink: "/report",
    allowedRoles: ["admin"], // admin and operator can view reports
  },
];

const Sidebar = () => {
  const [isSideBarEnlarged, setSideBarEnlarged] = useState(true);
  const toggleSideBarState = () => setSideBarEnlarged(!isSideBarEnlarged);
  const pathname = usePathname();
  const staff = useStaffStore((state) => state.staff);

  // Filter links based on user role
  const filteredLinks = links.filter(link => 
    link.allowedRoles.includes(staff.role.toLowerCase())
  );

  return (
    <>
      <div
        className={`${
          isSideBarEnlarged ? "lg:w-44 xl:w-52" : "w-14"
        } h-screen b-black shrink-0 relative z-20 hidden md:flex transition-all duration-100`}
      >
        <div
          className={`${
            isSideBarEnlarged ? "lg:w-44 xl:w-52" : "w-14"
          } md:flex md:flex-col items-center lg:items-start border-r border-neutral-200 bg-white h-screen fixed top-0 left-0 transition-all duration-100 flex flex-col justify-between`}
        >
          <div className="flex flex-col w-full">
            <div className="h-14 flex items-center justify-center lg:justify-start border-b w-full lg:p-3 lg:flex gap-2">
              <div className="rounded-[0.3rem] overflow-hidden h-9 aspect-square shrink-0">
                {/* Add your logo here */}
              </div>
              {isSideBarEnlarged && (
                <p className="font-bold text-emerald-600 hidden lg:block">Adeego</p>
              )}
            </div>
            <div className={`w-full hidden lg:flex md:flex ${
              isSideBarEnlarged ? "px-3 justify-start" : "px-0 justify-center"
            } my-4`}>
              <button
                onClick={toggleSideBarState}
                className="grid place-items-center h-10 aspect-square border border-neutral-200 rounded-[0.4rem] hover:border-neutral-500"
              >
                <PanelLeft
                  className="select-none pointer-events-none"
                  size={16}
                />
              </button>
            </div>
            <div className={`flex flex-col gap-4 md:gap-2 w-full items-left ${
              isSideBarEnlarged ? "px-1 lg:px-3" : "pl-3"
            } mt-4 lg:mt-0 transition-all duration-100`}>
              {filteredLinks.map((link, i) => {
                return (
                  <TooltipProvider delayDuration={100} key={i}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          className={`${
                            pathname === link.pageLink
                              ? "bg-neutral-200"
                              : "bg-white"
                          } ${
                            isSideBarEnlarged ? "" : "max-w-fit w-10 lg:!w-12"
                          } !cursor-pointer rounded-[0.4rem] m-aut w-full hover:bg-neutral-200/50`}
                          href={link.pageLink}
                        >
                          <div
                            className={` h-10 md:h-9 shrink-0 aspect-square xl:aspect-auto grid place-items-center lg:flex items-center gap-2 lg:gap-3   px-2 rounded-[0.3rem] transition group/link`}
                          >
                            <div
                              className={`${
                                pathname === link.pageLink
                                  ? "text-black"
                                  : "text-neutral-500 lg:text-neutral-500"
                              } group-hover/link:text-neutral-700 transition`}
                            >
                              {link.icon}
                            </div>
                            {isSideBarEnlarged && (
                              <div
                                className={`${
                                  pathname === link.pageLink
                                    ? "text-black"
                                    : "text-neutral-400 lg:text-neutral-500"
                                } group-hover/link:text-neutral-700 transition hidden lg:block text-sm`}
                              >
                                {link.label}
                              </div>
                            )}
                          </div>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className={`bg-white rounded-[0.3rem] text-xs ${
                          isSideBarEnlarged ? "lg:hidden" : ""
                        } `}
                      >
                        <p>{link.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>
          
          <div 
            className={`flex flex-col gap-4 md:gap-2 w-full items-center ${
              isSideBarEnlarged ? "px-1 lg:px-3" : "pl-3"
            } mb-4 transition-all duration-100 justify-center`}
          >
            <WsDropdownMenu 
              isSideBarEnlarged={isSideBarEnlarged} 
              icon={<Settings className="h-[18px] w-[18px]" strokeWidth={2} />}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
