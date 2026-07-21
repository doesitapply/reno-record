import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Scale, Shield, Users, FileText, ChevronRight } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { useSEO } from "@/hooks/useSEO";

const AGENCY_TYPE_LABELS: Record<string, string> = {
  court: "Court",
  prosecutor: "Prosecutor",
  law_enforcement: "Law Enforcement",
  public_defender: "Public Defender",
  government_department: "Government Department",
  oversight_body: "Oversight Body",
  municipality: "Municipality",
  state_agency: "State Agency",
  federal_agency: "Federal Agency",
  other: "Other",
};

const AGENCY_TYPE_ICONS: Record<string, React.ReactNode> = {
  court: <Scale className="w-5 h-5" />,
  prosecutor: <FileText className="w-5 h-5" />,
  law_enforcement: <Shield className="w-5 h-5" />,
  public_defender: <Users className="w-5 h-5" />,
  government_department: <Building2 className="w-5 h-5" />,
  oversight_body: <Scale className="w-5 h-5" />,
  municipality: <Building2 className="w-5 h-5" />,
  state_agency: <Building2 className="w-5 h-5" />,
  federal_agency: <Building2 className="w-5 h-5" />,
  other: <Building2 className="w-5 h-5" />,
};

const AGENCY_TYPE_COLORS: Record<string, string> = {
  court: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  prosecutor: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  law_enforcement: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  public_defender: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  government_department: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-primary/80",
  oversight_body: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  municipality: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  state_agency: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  federal_agency: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function Agencies() {
  const { data: agencies, isLoading } = trpc.agency.list.useQuery();

  const grouped = agencies?.reduce(
    (acc, agency) => {
      const type = agency.agencyType ?? "other";
      if (!acc[type]) acc[type] = [];
      acc[type].push(agency);
      return acc;
    },
    {} as Record<string, typeof agencies>,
  );

  const typeOrder = [
    "court", "prosecutor", "law_enforcement", "public_defender",
    "government_department", "oversight_body", "municipality",
    "state_agency", "federal_agency", "other",
  ];

  useSEO({ title: "Agency Directory — The Reno Record" });

  return (
    <SiteShell>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-10">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Agency Directory</h1>
              <p className="text-muted-foreground mt-1 max-w-2xl">
                Public institutions documented in the archive. Each agency page aggregates all
                linked actors, documents, and procedural concerns associated with that institution.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="text-xs">
                  Washoe County, Nevada
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {agencies?.length ?? 0} agencies indexed
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : !agencies?.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No agencies indexed yet</p>
            <p className="text-sm mt-1">Agency profiles are added as documents are ingested.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {typeOrder.map((type) => {
              const group = grouped?.[type];
              if (!group?.length) return null;
              return (
                <section key={type}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`p-1.5 rounded-lg ${AGENCY_TYPE_COLORS[type]}`}>
                      {AGENCY_TYPE_ICONS[type]}
                    </span>
                    <h2 className="text-lg font-semibold">{AGENCY_TYPE_LABELS[type]}</h2>
                    <span className="text-xs text-muted-foreground">({group.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.map((agency) => (
                      <Link key={agency.id} href={`/agencies/${agency.slug}`}>
                        <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">
                                {agency.name}
                              </CardTitle>
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="flex flex-wrap gap-1.5">
                              {agency.jurisdictionName && (
                                <Badge variant="secondary" className="text-xs">
                                  {agency.jurisdictionName}
                                </Badge>
                              )}
                              {agency.state && (
                                <Badge variant="outline" className="text-xs">
                                  {agency.state}
                                </Badge>
                              )}
                            </div>
                            {agency.notes && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {agency.notes}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </SiteShell>
  );
}
