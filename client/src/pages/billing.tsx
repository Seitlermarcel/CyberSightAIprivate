import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  TrendingUp,
  Package,
  Database,
  Activity,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Info,
  ShoppingCart,
} from "lucide-react";
import { format } from "date-fns";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

function CheckoutForm({ selectedPackage, onSuccess, onCancel }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !selectedPackage) {
      return;
    }

    setIsProcessing(true);

    try {
      // Create payment intent
      const response = await apiRequest("POST", "/api/billing/purchase", {
        packageId: selectedPackage.id
      });

      if (response.clientSecret) {
        // Confirm payment with Stripe
        const { error } = await stripe.confirmCardPayment(response.clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement)!,
          }
        });

        if (error) {
          toast({
            title: "Payment Failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Payment Successful",
            description: "Credits have been added to your account!",
          });
          onSuccess();
        }
      } else {
        // Mock payment succeeded
        toast({
          title: "Purchase Successful",
          description: "Credits have been added to your account!",
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Purchase Failed",
        description: "Unable to complete the purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 cyber-dark rounded-lg">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#ffffff',
                '::placeholder': {
                  color: '#9ca3af',
                },
              },
              invalid: {
                color: '#ef4444',
              },
            },
          }}
        />
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="cyber-blue hover:bg-blue-600"
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? "Processing..." : `Purchase ${selectedPackage?.name}`}
        </Button>
      </div>
    </form>
  );
}

export default function Billing() {
  const { toast } = useToast();
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);

  // Fetch user data with credits
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  // Fetch billing transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/billing/transactions"],
  });

  // Fetch usage statistics
  const { data: usage } = useQuery({
    queryKey: ["/api/billing/usage"],
  });

  const handlePurchaseSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    queryClient.invalidateQueries({ queryKey: ["/api/billing/transactions"] });
    setShowPurchaseDialog(false);
    setSelectedPackage(null);
  };

  const creditPackages = [
    { id: "starter", name: "Starter Pack", credits: 20, price: 50, savings: 0 },
    { id: "professional", name: "Professional", credits: 50, price: 120, savings: 5 },
    { id: "business", name: "Business", credits: 100, price: 230, savings: 20 },
    { id: "enterprise", name: "Enterprise", credits: 200, price: 440, savings: 60 },
  ];

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "credit-purchase": return <CreditCard className="text-green-500" />;
      case "incident-analysis": return <Activity className="text-blue-500" />;
      case "storage-fee": return <Database className="text-orange-500" />;
      case "refund": return <DollarSign className="text-purple-500" />;
      default: return <DollarSign className="text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "credit-purchase": return "text-green-500";
      case "incident-analysis": return "text-blue-500";
      case "storage-fee": return "text-orange-500";
      case "refund": return "text-purple-500";
      default: return "text-gray-500";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Credits</h1>
        <p className="text-gray-500">Manage your credits and view usage statistics</p>
      </div>

      {/* Current Balance & Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Current Balance</span>
              <CreditCard className="text-cyber-blue" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">
                €{parseFloat(user?.credits || "0").toFixed(2)}
              </div>
              <p className="text-sm text-gray-400">Available credits</p>
              <Button 
                className="w-full cyber-blue hover:bg-blue-600"
                onClick={() => setShowPurchaseDialog(true)}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Purchase Credits
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>This Month's Usage</span>
              <TrendingUp className="text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Incidents Analyzed</span>
                  <span className="font-medium">{usage?.incidentsAnalyzed || 0}</span>
                </div>
                <div className="text-xs text-gray-400">
                  €{((usage?.incidentsAnalyzed || 0) * 2.5).toFixed(2)} spent
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Storage Used</span>
                  <span className="font-medium">{(usage?.storageGB || 0).toFixed(2)} GB</span>
                </div>
                <div className="text-xs text-gray-400">
                  €{(usage?.storageGB || 0).toFixed(2)} per month
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Subscription</span>
              <Package className="text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className="capitalize">
                {user?.subscriptionPlan || "Free"}
              </Badge>
              <p className="text-sm text-gray-400">
                {user?.subscriptionPlan === "free" 
                  ? "Limited features" 
                  : "Full access to all features"}
              </p>
              {user?.subscriptionPlan === "free" && (
                <Button variant="outline" className="w-full">
                  Upgrade Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Information */}
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <CardTitle>Pricing Information</CardTitle>
          <CardDescription>Transparent pricing for all services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 cyber-dark rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="text-blue-500" />
                <h4 className="font-semibold">Incident Analysis</h4>
              </div>
              <p className="text-2xl font-bold">€2.50</p>
              <p className="text-sm text-gray-400">per incident analyzed</p>
            </div>
            <div className="p-4 cyber-dark rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="text-orange-500" />
                <h4 className="font-semibold">Data Storage</h4>
              </div>
              <p className="text-2xl font-bold">€1.00</p>
              <p className="text-sm text-gray-400">per GB per month</p>
            </div>
            <div className="p-4 cyber-dark rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="text-red-500" />
                <h4 className="font-semibold">Data Retention</h4>
              </div>
              <p className="text-2xl font-bold">30 days</p>
              <p className="text-sm text-gray-400">automatic deletion after</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Recent billing transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-cyber-blue border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-400">Loading transactions...</p>
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((transaction: any) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 cyber-dark rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getTransactionIcon(transaction.type)}
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(transaction.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${getTransactionColor(transaction.type)}`}>
                      {transaction.type === "credit-purchase" ? "+" : "-"}€{transaction.amount}
                    </p>
                    <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No transactions yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Credits Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase Credits</DialogTitle>
            <DialogDescription>
              Select a credit package that suits your needs
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {creditPackages.map((pkg) => (
              <Card 
                key={pkg.id} 
                className={`cursor-pointer transition-all ${
                  selectedPackage?.id === pkg.id 
                    ? "border-cyber-blue" 
                    : "border-cyber-slate-light hover:border-gray-600"
                }`}
                onClick={() => setSelectedPackage(pkg)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{pkg.name}</CardTitle>
                  {pkg.savings > 0 && (
                    <Badge className="bg-green-600 text-white">
                      Save €{pkg.savings}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">€{pkg.price}</div>
                  <p className="text-sm text-gray-400">
                    {pkg.credits} credits • €{(pkg.price / pkg.credits).toFixed(2)} per credit
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Analyze {Math.floor(pkg.credits / 2.5)} incidents
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
              Cancel
            </Button>
            {stripePromise && import.meta.env.VITE_STRIPE_PUBLIC_KEY ? (
              <Elements stripe={stripePromise}>
                <CheckoutForm 
                  selectedPackage={selectedPackage}
                  onSuccess={handlePurchaseSuccess}
                  onCancel={() => setShowPurchaseDialog(false)}
                />
              </Elements>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Stripe is not configured. Using development mode.</p>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    className="cyber-blue hover:bg-blue-600"
                    disabled={!selectedPackage}
                    onClick={async () => {
                      if (selectedPackage) {
                        try {
                          await apiRequest("POST", "/api/billing/purchase", { packageId: selectedPackage.id });
                          handlePurchaseSuccess();
                        } catch (error) {
                          toast({
                            title: "Purchase Failed",
                            description: "Unable to complete the purchase.",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                  >
                    Purchase {selectedPackage?.name}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}