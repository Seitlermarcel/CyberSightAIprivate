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
// Validate that we're not using a secret key (which starts with sk_)
const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY || "";
const isValidPublishableKey = stripeKey.startsWith("pk_");
const stripePromise = isValidPublishableKey ? loadStripe(stripeKey) : null;

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
      const response = await apiRequest("POST", "/api/billing/create-payment-intent", {
        packageId: selectedPackage.id
      });
      
      const data = await response.json();

      if (data.clientSecret) {
        // Confirm payment with Stripe
        const { error } = await stripe.confirmCardPayment(data.clientSecret, {
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
  const { data: user = {} } = useQuery({
    queryKey: ["/api/user"],
  });

  // Fetch billing transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/billing/transactions"],
  });

  // Fetch usage statistics
  const { data: usage = {} } = useQuery({
    queryKey: ["/api/billing/usage"],
  });

  const handlePurchaseSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    queryClient.invalidateQueries({ queryKey: ["/api/billing/transactions"] });
    setShowPurchaseDialog(false);
    setSelectedPackage(null);
  };

  const subscriptionPackages = [
    { 
      id: "starter", 
      name: "Starter Package", 
      incidentsIncluded: 10, 
      storageIncluded: 2,
      price: 250, 
      pricePerIncident: 25,
      discount: 0,
      features: ['Basic Analysis', '2GB storage included', '€25 per incident', '30-day data retention']
    },
    { 
      id: "professional", 
      name: "Professional Package", 
      incidentsIncluded: 25, 
      storageIncluded: 10,
      price: 594, 
      pricePerIncident: 23.75,
      discount: 5,
      features: ['Enhanced Analysis', '10GB storage included', '€23.75 per incident (5% discount)', '60-day data retention']
    },
    { 
      id: "business", 
      name: "Business Package", 
      incidentsIncluded: 100, 
      storageIncluded: 25,
      price: 2250, 
      pricePerIncident: 22.50,
      discount: 10,
      features: ['Advanced Analysis', '25GB storage included', '€22.50 per incident (10% discount)', '90-day data retention', 'Priority support']
    },
    { 
      id: "enterprise", 
      name: "Enterprise Package", 
      incidentsIncluded: 250, 
      storageIncluded: 100,
      price: 5000, 
      pricePerIncident: 20,
      discount: 20,
      features: ['Full Analysis Suite', '100GB storage included', '€20 per incident (20% discount)', '365-day data retention', 'Dedicated support']
    },
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
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-gray-500">Manage your subscription plan and view usage statistics</p>
      </div>

      {/* Current Balance & Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Remaining Analyses</span>
              <CreditCard className="text-cyber-blue" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">
                {Math.floor(parseFloat((user as any)?.credits || "0"))}
              </div>
              <p className="text-sm text-gray-400">
                Remaining analyses in your {(user as any)?.subscriptionPlan || 'current'} plan
              </p>
              <Button 
                className="w-full cyber-blue hover:bg-blue-600"
                onClick={() => setShowPurchaseDialog(true)}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Upgrade Plan
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
                  <span className="font-medium">{(usage as any)?.incidentsAnalyzed || 0}</span>
                </div>
                <div className="text-xs text-gray-400">
                  €{((usage as any)?.incidentsCost || 0).toFixed(2)} spent
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Storage Used</span>
                  <span className="font-medium">{((usage as any)?.storageGB || 0).toFixed(2)} GB</span>
                </div>
                <div className="text-xs text-gray-400">
                  {(usage as any)?.storageIncluded || 0} GB included • €{((usage as any)?.storageOverageCost || 0).toFixed(2)} overage
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">Total Cost</span>
                  <span className="font-bold">€{((usage as any)?.totalCost || 0).toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-400">
                  This month's charges
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
                {(user as any)?.subscriptionPlan || "Free"}
              </Badge>
              <p className="text-sm text-gray-400">
                {(user as any)?.subscriptionPlan === "free" 
                  ? "Limited features" 
                  : "Full access to all features"}
              </p>
              {(user as any)?.subscriptionPlan === "free" && (
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
              <p className="text-2xl font-bold">€20-25</p>
              <p className="text-sm text-gray-400">per incident (varies by plan)</p>
            </div>
            <div className="p-4 cyber-dark rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="text-orange-500" />
                <h4 className="font-semibold">Data Storage</h4>
              </div>
              <p className="text-2xl font-bold">€1.00</p>
              <p className="text-sm text-gray-400">per GB above plan limit</p>
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
          ) : transactions && (transactions as any[]).length > 0 ? (
            <div className="space-y-2">
              {(transactions as any[]).map((transaction: any) => (
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
            <DialogTitle>Choose Subscription Plan</DialogTitle>
            <DialogDescription>
              Select a subscription plan that suits your analysis needs
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {subscriptionPackages.map((pkg) => (
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
                  {pkg.discount > 0 && (
                    <Badge className="bg-green-600 text-white">
                      {pkg.discount}% Discount
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">€{pkg.price}</div>
                  <p className="text-sm text-gray-400">
                    {pkg.incidentsIncluded} incidents • {pkg.storageIncluded}GB storage
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    €{pkg.pricePerIncident} per incident
                  </p>
                  <ul className="text-xs text-gray-400 mt-2 space-y-1">
                    {pkg.features.slice(0, 3).map((feature, index) => (
                      <li key={index}>• {feature}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
              Cancel
            </Button>
            {stripePromise && isValidPublishableKey ? (
              <Elements stripe={stripePromise}>
                <CheckoutForm 
                  selectedPackage={selectedPackage}
                  onSuccess={handlePurchaseSuccess}
                  onCancel={() => setShowPurchaseDialog(false)}
                />
              </Elements>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-red-400">
                  {stripeKey.startsWith("sk_") 
                    ? "Error: Secret key detected. Please configure VITE_STRIPE_PUBLIC_KEY with a publishable key (starts with pk_)" 
                    : "Stripe is not configured. Please set VITE_STRIPE_PUBLIC_KEY environment variable."}
                </p>
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
                          const result = await apiRequest("POST", "/api/billing/create-payment-intent", { packageId: selectedPackage.id });
                          const data = await result.json();
                          if (data.devMode) {
                            handlePurchaseSuccess();
                            toast({
                              title: "Development Mode",
                              description: data.message,
                            });
                          }
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