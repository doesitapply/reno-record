import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import SiteShell from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, CreditCard, ExternalLink, Shield, Crown, Star, BookOpen } from "lucide-react";

const TIER_ICONS: Record<string, React.ReactNode> = {
  free: <BookOpen className="w-5 h-5" />,
  receipts: <Shield className="w-5 h-5" />,
  goblin_pro: <Zap className="w-5 h-5" />,
  founding: <Star className="w-5 h-5" />,
  founders_circle: <Crown className="w-5 h-5" />,
};

const TIER_COLORS: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  receipts: "bg-blue-500/10 text-blue-500",
  goblin_pro: "bg-primary/10 text-primary",
  founding: "bg-primary/10 text-primary",
  founders_circle: "bg-purple-500/10 text-purple-500",
};

export default function Billing() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();

  const { data: sub, isLoading } = trpc.billing.mySubscription.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: creditPacks } = trpc.billing.creditPacks.useQuery();

  const billingPortal = trpc.billing.billingPortal.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank"),
    onError: (err) => toast.error(err.message),
  });

  const createPackCheckout = trpc.billing.createCreditPackCheckout.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank"),
    onError: (err) => toast.error(err.message),
  });

  if (!user || isLoading) {
    return (
      <SiteShell>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
          Loading billing information…
        </div>
      </SiteShell>
    );
  }

  const tier = sub?.tier ?? "free";
  const iconClass = TIER_COLORS[tier] ?? TIER_COLORS.free;

  return (
    <SiteShell>
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Billing & Access</h1>
          <p className="text-muted-foreground text-sm">
            Manage your subscription, credits, and access level.
          </p>
        </div>

        {/* Current plan */}
        <div className="border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">Current Plan</h2>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${iconClass}`}>
              {TIER_ICONS[tier]}
            </div>
            <div>
              <p className="font-semibold text-xl">{sub?.tierLabel ?? "Free"}</p>
              <p className="text-sm text-muted-foreground capitalize">
                Status: {sub?.status === "none" ? "Active (free)" : sub?.status}
              </p>
            </div>
            {tier !== "free" && (
              <Badge variant="outline" className="ml-auto">
                Active
              </Badge>
            )}
          </div>

          {/* Access summary */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground text-xs mb-1">Archive Access</p>
              <p className="font-medium">{sub?.hasReceipts ? "Full archive + PDF viewer" : "Browse only"}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground text-xs mb-1">Docket Goblin</p>
              <p className="font-medium">
                {sub?.hasGoblinPro
                  ? `${sub.goblinCredits} credits`
                  : sub?.goblinFreeRemaining && sub.goblinFreeRemaining > 0
                  ? `${sub.goblinFreeRemaining} free uses left`
                  : "Upgrade required"}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {sub?.stripeCustomerId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => billingPortal.mutate({ origin: window.location.origin })}
                disabled={billingPortal.isPending}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Billing
                <ExternalLink className="w-3 h-3 ml-2 opacity-50" />
              </Button>
            )}
            {tier === "free" && (
              <Button size="sm" onClick={() => navigate("/pricing")}>
                Upgrade Plan
              </Button>
            )}
          </div>
        </div>

        {/* Credit packs */}
        <div className="border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Goblin Credit Packs</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Each Docket Goblin ingest costs 10 credits. Buy packs to top up at any time.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(creditPacks ?? []).map((pack) => (
              <div
                key={pack.id}
                className="border border-border rounded-lg p-4 flex flex-col gap-2 bg-card"
              >
                <p className="font-semibold">{pack.label}</p>
                <p className="text-xl font-bold">${(pack.price / 100).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{pack.credits} credits</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() =>
                    createPackCheckout.mutate({ packId: pack.id, origin: window.location.origin })
                  }
                  disabled={createPackCheckout.isPending}
                >
                  Buy
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade CTA for free users */}
        {tier === "free" && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
            <p className="font-semibold">Unlock the full record</p>
            <p className="text-sm text-muted-foreground">
              Receipts tier gives you full PDF access, unlimited exports, and submission rights.
              Goblin Pro adds AI-powered document analysis.
            </p>
            <Button onClick={() => navigate("/pricing")}>View Plans</Button>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
