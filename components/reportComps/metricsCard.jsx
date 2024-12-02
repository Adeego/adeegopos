import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { ArrowUpIcon, ArrowDownIcon  } from "lucide-react";

function MetricCard({ title, value, icon, change, trend, color }) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-gray-200 bg-gray-50 p-4">
          <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="rounded-full bg-gray-100 p-2">{icon}</span>
              <span className="text-2xl font-bold">{value}</span>
            </div>
            <div className={`flex items-center space-x-1 ${color === 'green' ? 'text-green-600' : 'text-red-600'}`}>
              {trend === 'up' ? (
                <ArrowUpIcon className="h-4 w-4" />
              ) : (
                <ArrowDownIcon className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">{change}%</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">vs yesterday</p>
        </CardContent>
      </Card>
    )
  }

  export default MetricCard;