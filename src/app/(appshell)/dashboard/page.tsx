"use client";
import { Card, CardContent, PageHeader } from "@/components/ui";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DASHBOARD_STATS, dashboardIcons } from "@/constants/dashboard";
import { EventCalender } from "@/components/dashboard/event-calender";
import { useAuth } from "@/context/auth";
import { CalendarIcon } from "@/components/ui/icons";
import { DashboardIconName } from "@/types/dashboard";

const hour = new Date().getHours();
const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

function getIcon(iconName: DashboardIconName, size = 24, className?: string) {
    const IconComponent = dashboardIcons[iconName] || CalendarIcon;
    return <IconComponent size={size} className={className} />;
}

export default function DashboardPage() {
    const { user } = useAuth();

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <PageHeader
                title={`${greeting}, ${user?.name || "there"}!`}
                description="Here's what's happening with your events today."
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
                {DASHBOARD_STATS.map(stat => {
                    const isPositiveTrend = stat.trend?.startsWith("+");
                    return (
                        <Card
                            key={stat.label}
                            className="rounded-2xl border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-md"
                        >
                            <CardContent className="p-0">
                                <div className="mb-4 flex items-center justify-between">
                                    <div
                                        className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.iconBg} ${stat.iconColor}`}
                                    >
                                        {getIcon(stat.icon, 24)}
                                    </div>
                                    {stat.trend && (
                                        <span
                                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                                                isPositiveTrend
                                                    ? "bg-emerald-50 text-emerald-600"
                                                    : "bg-red-50 text-red-600"
                                            }`}
                                        >
                                            {stat.trend}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">
                                    {stat.value}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Event Calendar and Quick Actions */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
                <div className="lg:col-span-7 xl:col-span-8">
                    <EventCalender />
                </div>
                <div className="lg:col-span-5 xl:col-span-4">
                    <QuickActions />
                </div>
            </div>
        </div>
    );
}