import React, { useState } from "react";
import Image from 'next/image';
import Link from "next/link";
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/router';
import WsDropdownMenu from "./wholesalerComps/wsDropdownMenu";
import useStaffStore from "../stores/staffStore";
import posLogo from '@/assets/pos.png';

// Icons
import {
  AlertCircle,
  BadgeDollarSign,
  ChartLine,
  Cable,
  Calculator,
  PanelLeft,
  Home,
  History,
  ShoppingBag,
  ShoppingCart,
  UsersRound,
  BriefcaseBusiness,
  Settings,
  Store,
  CalendarClock,
  TrendingUp,
  Package,
  Receipt,
  FileText,
  DollarSign,
  ClipboardCheck,
  ArrowRightLeft,
  LineChart,
  Landmark,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  Bot,
} from "lucide-react";
import { getUiSections } from "@/lib/rbac";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

const icons = {
  alertCircle: AlertCircle,
  arrowRightLeft: ArrowRightLeft,
  badgeDollarSign: BadgeDollarSign,
  bot: Bot,
  briefcaseBusiness: BriefcaseBusiness,
  cable: Cable,
  calculator: Calculator,
  calendarClock: CalendarClock,
  chartLine: ChartLine,
  clipboardCheck: ClipboardCheck,
  dollarSign: DollarSign,
  fileText: FileText,
  history: History,
  home: Home,
  landmark: Landmark,
  lineChart: LineChart,
  messageCircle: MessageCircle,
  package: Package,
  receipt: Receipt,
  refreshCw: RefreshCw,
  settings: Settings,
  shieldCheck: ShieldCheck,
  shoppingBag: ShoppingBag,
  shoppingCart: ShoppingCart,
  store: Store,
  trendingUp: TrendingUp,
  usersRound: UsersRound,
  walletCards: WalletCards,
};

const renderIcon = (name, className = "h-[18px] w-[18px]") => {
  const Icon = icons[name] || Settings;
  return <Icon className={className} strokeWidth={2} />;
};

const Sidebar = () => {
  const [isSideBarEnlarged, setSideBarEnlarged] = useState(true);
  const toggleSideBarState = () => setSideBarEnlarged(!isSideBarEnlarged);
  const pathname = usePathname();
  const router = useRouter();
  const staff = useStaffStore((state) => state.staff);

  const filteredGroups = getUiSections(staff);
  const isActive = (link) => {
    const target = link.pageLink || link.route;

    if (target?.includes('?')) {
      const currentPath = router.asPath.split('#')[0];

      return currentPath === target || currentPath.startsWith(`${target}&`);
    }

    return pathname === (link.route || target).split('?')[0];
  };

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
          } md:flex md:flex-col items-center lg:items-start border-r border-neutral-200 bg-white h-screen fixed top-0 left-0 transition-all duration-100 flex flex-col overflow-hidden`}
        >
          <div className="flex min-h-0 flex-1 flex-col w-full">
            <div className="h-14 shrink-0 flex items-center justify-center lg:justify-start border-b w-full lg:p-3 lg:flex gap-2">
              <div className="rounded-[0.5rem] overflow-hidden h-9 aspect-square shrink-0">
                <Image 
                  src={posLogo}
                  alt="Adeego POS Logo" 
                  width={36} 
                  height={36} 
                  className="object-cover"
                />
              </div>
              {isSideBarEnlarged && (
                <p className="font-bold text-lg text-[#0D1B2C] hidden lg:block">ADEEGO POS</p>
              )}
            </div>
            <div className={`w-full hidden lg:flex md:flex ${
              isSideBarEnlarged ? "px-3 justify-start" : "px-0 justify-center"
            } my-4 shrink-0`}>
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
            <div className={`flex flex-col gap-2 w-full ${
              isSideBarEnlarged ? "px-1 lg:px-3" : "px-1"
            } mt-4 lg:mt-0 transition-all duration-100 overflow-y-auto flex-1 min-h-0 pb-3`}>
              {isSideBarEnlarged ? (
                <Accordion type="multiple" className="w-full" defaultValue={filteredGroups.map(g => g.key)}>
                  {filteredGroups.map((group, groupIndex) => (
                    <AccordionItem key={group.key || groupIndex} value={group.key} className="border-none">
                      <AccordionTrigger className="py-2 px-2 hover:bg-neutral-100 rounded-md hover:no-underline">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <div className="text-neutral-600">{renderIcon(group.icon, "h-4 w-4")}</div>
                          <span className="text-neutral-700">{group.label}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-2">
                        <div className="flex flex-col gap-1 ml-2">
                          {group.links.map((link, linkIndex) => (
                            <TooltipProvider delayDuration={100} key={linkIndex}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link
                                    className={`${
                                      isActive(link)
                                        ? "bg-neutral-200"
                                        : "bg-white"
                                    } !cursor-pointer rounded-[0.4rem] w-full hover:bg-neutral-200/50`}
                                    href={link.pageLink}
                                  >
                                    <div className="h-9 flex items-center gap-3 px-3 rounded-[0.3rem] transition group/link">
                                      <div
                                        className={`${
                                          isActive(link)
                                            ? "text-black"
                                            : "text-neutral-500"
                                        } group-hover/link:text-neutral-700 transition`}
                                      >
                                        {renderIcon(link.icon)}
                                      </div>
                                      <div
                                        className={`${
                                          isActive(link)
                                            ? "text-black"
                                            : "text-neutral-500"
                                        } group-hover/link:text-neutral-700 transition text-sm`}
                                      >
                                        {link.label}
                                      </div>
                                    </div>
                                  </Link>
                                </TooltipTrigger>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                // Collapsed sidebar - show only icons
                <div className="flex flex-col gap-2">
                  {filteredGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="flex flex-col gap-1">
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="p-2 hover:bg-neutral-100 rounded-md cursor-pointer">
                              <div className="text-neutral-600">{renderIcon(group.icon, "h-4 w-4")}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="bg-white">
                            <p className="font-medium">{group.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {group.links.map((link, linkIndex) => (
                        <TooltipProvider delayDuration={100} key={linkIndex}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                className={`${
                                  isActive(link)
                                    ? "bg-neutral-200"
                                    : "bg-white"
                                } !cursor-pointer rounded-[0.4rem] hover:bg-neutral-200/50 p-2 flex items-center justify-center`}
                                href={link.pageLink}
                              >
                                <div
                                  className={`${
                                      isActive(link)
                                      ? "text-black"
                                      : "text-neutral-500"
                                  } transition`}
                                >
                                  {renderIcon(link.icon)}
                                </div>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="bg-white">
                              <p>{link.label}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div 
            className={`flex flex-col gap-4 md:gap-2 w-full items-center ${
              isSideBarEnlarged ? "px-1 lg:px-3" : "pl-3"
            } mb-4 shrink-0 transition-all duration-100 justify-center`}
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
