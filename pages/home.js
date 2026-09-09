import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  BadgeDollarSign,
  BriefcaseBusiness,
  Cable,
  Calculator,
  CalendarClock,
  ChartLine,
  ClipboardCheck,
  DollarSign,
  FileText,
  History,
  Home as HomeIcon,
  Landmark,
  MessageCircle,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import useStaffStore from '@/stores/staffStore';
import useWsinfoStore from '@/stores/wsinfo';
import { getRoleHomeSections, getRoleLabels } from '@/lib/rbac';

const icons = {
  alertCircle: AlertCircle,
  arrowRightLeft: ArrowRightLeft,
  badgeDollarSign: BadgeDollarSign,
  briefcaseBusiness: BriefcaseBusiness,
  cable: Cable,
  calculator: Calculator,
  calendarClock: CalendarClock,
  chartLine: ChartLine,
  clipboardCheck: ClipboardCheck,
  dollarSign: DollarSign,
  fileText: FileText,
  history: History,
  home: HomeIcon,
  landmark: Landmark,
  lineChart: ChartLine,
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

const renderIcon = (name, className = 'h-5 w-5') => {
  const Icon = icons[name] || Settings;
  return <Icon className={className} strokeWidth={2} />;
};

export default function Home() {
  const staff = useStaffStore((state) => state.staff);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const sections = getRoleHomeSections(staff);
  const roleLabels = getRoleLabels(staff);
  const quickActions = sections.flatMap((section) => section.links.slice(0, 2)).slice(0, 6);

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {staff.firstName ? `${staff.firstName}'s Workspace` : 'Workspace'}
            </h1>
            {roleLabels.map((role) => (
              <Badge key={role} variant="secondary">{role}</Badge>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {wsinfo.name || wsinfo.storeName || wsinfo.storeNo || 'Adeego POS'}
          </p>
        </div>

        {quickActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quickActions.slice(0, 3).map((action) => (
              <Button key={action.pageLink} asChild>
                <Link href={action.pageLink}>
                  {renderIcon(action.icon, 'mr-2 h-4 w-4')}
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </section>

      {quickActions.length > 0 && (
        <section className="grid gap-3 md:grid-cols-3">
          {quickActions.slice(3).map((action) => (
            <Link key={action.pageLink} href={action.pageLink} className="rounded-md border bg-white p-4 transition hover:border-neutral-400 hover:bg-neutral-50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                    {renderIcon(action.icon)}
                  </div>
                  <span className="font-medium">{action.label}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.key} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                      {renderIcon(section.icon, 'h-4 w-4')}
                    </span>
                    {section.label}
                  </CardTitle>
                  <CardDescription className="mt-2">{section.description}</CardDescription>
                </div>
                <Badge variant="outline" className="capitalize">{staff.isOwner ? 'manage' : staff.moduleAccess?.[section.id]}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {section.links.map((link) => (
                  <Button key={link.pageLink} variant="outline" asChild className="h-11 justify-start">
                    <Link href={link.pageLink}>
                      {renderIcon(link.icon, 'mr-2 h-4 w-4')}
                      {link.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {sections.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>No workspace sections are available for the current staff account.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
