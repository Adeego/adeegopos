import SubscriptionTable from "@/components/adeegoPlusComps/subscriptionTable";
import TodayDeliveries from "@/components/adeegoPlusComps/todayDeliveries";

export default function AdeegoPlus() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Adeego Plus</h1>
        <p className="text-muted-foreground">Manage recurring delivery subscriptions</p>
      </div>
      
      <TodayDeliveries />
      <SubscriptionTable />
    </div>
  );
}
