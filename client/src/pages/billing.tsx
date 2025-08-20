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
            description: "Package has been activated for your account!",
          });
          onSuccess();
        }
      } else {
        // Mock payment succeeded
        toast({
          title: "Purchase Successful",
          description: "Package has been activated for your account!",
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

  const { data: storageData = {} } = useQuery({
    queryKey: ["/api/storage/usage"],
  });

  const { data: cleanupData = {} } = useQuery({
    queryKey: ["/api/storage/cleanup-preview"],
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
      storageIncluded: 1,
      price: 250, 
      pricePerIncident: 25,
      discount: 0,
      features: ['10 incident analyses', '1GB storage included', '€25 per incident', '30-day data retention']
    },
    { 
      id: "professional", 
      name: "Professional Package", 
      incidentsIncluded: 50, 
      storageIncluded: 2.5,
      price: 1187.50, 
      pricePerIncident: 23.75,
      discount: 5,
      features: ['50 incident analyses', '2.5GB storage included', '€23.75 per incident', '5% discount', '30-day data retention']
    },
    { 
      id: "business", 
      name: "Business Package", 
      incidentsIncluded: 100, 
      storageIncluded: 10,
      price: 2250, 
      pricePerIncident: 22.50,
      discount: 10,
      features: ['100 incident analyses', '10GB storage included', '€22.50 per incident', '10% discount', '30-day data retention']
    },
    { 
      id: "enterprise", 
      name: "Enterprise Package", 
      incidentsIncluded: 250, 
      storageIncluded: 50,
      price: 5000, 
      pricePerIncident: 20,
      discount: 20,
      features: ['250 incident analyses', '50GB storage included', '€20 per incident', '20% discount', '30-day data retention']
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
        <h1 className="text-2xl font-bold">Billing & Usage</h1>
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
                {(user as any)?.remainingIncidents || 0}
              </div>
              <p className="text-sm text-gray-400">
                Remaining incident analyses • {(user as any)?.currentPackage || 'starter'} package
              </p>
              <div className="text-xs text-gray-500 mt-1">
                {(usage as any)?.incidentsAnalyzed || 0} incidents analyzed this month
              </div>
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
                  From {(user as any)?.currentPackage || 'starter'} package
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Storage Used</span>
                  <span className="font-medium">
                    {((storageData as any)?.usage?.details?.totalMB || 0).toFixed(2)} MB
                  </span>
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  {((storageData as any)?.limit || 0)} GB limit • {((storageData as any)?.usage?.incidentCount || 0)} incidents
                </div>
                <Progress 
                  value={Math.max(0.01, ((storageData as any)?.quota?.percentage || 0))} 
                  className={`h-2 ${
                    ((storageData as any)?.quota?.percentage || 0) > 90 ? 'bg-red-100 [&>div]:bg-red-500' : 
                    ((storageData as any)?.quota?.percentage || 0) > 75 ? 'bg-yellow-100 [&>div]:bg-yellow-500' : 'bg-green-100 [&>div]:bg-green-500'
                  }`}
                />
                <div className="text-xs text-gray-400 mt-1">
                  {(() => {
                    const percentage = ((storageData as any)?.quota?.percentage || 0);
                    const currentPackage = (user as any)?.currentPackage || 'starter';
                    
                    // Dynamic precision based on plan storage size
                    const decimalPlaces = {
                      'starter': 2,      // 1GB - show 0.01%
                      'professional': 3, // 2.5GB - show 0.001%
                      'business': 3,     // 10GB - show 0.001%
                      'enterprise': 4    // 50GB - show 0.0001%
                    };
                    
                    return percentage.toFixed(decimalPlaces[currentPackage as keyof typeof decimalPlaces] || 2);
                  })()}% used • 
                  {((storageData as any)?.quota?.canCreateNew ? ' Space available' : ' Near limit')}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">Total Cost</span>
                  <span className="font-bold">€0.00</span>
                </div>
                <div className="text-xs text-gray-400">
                  Package quota system • No additional charges
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge className="capitalize text-sm px-3 py-1">
                  {(user as any)?.currentPackage || "starter"}
                </Badge>
                <div className="text-right">
                  <div className="text-lg font-bold text-cyber-blue">
                    {(user as any)?.currentPackage || 'starter'}
                  </div>
                  <div className="text-xs text-gray-400">Current Package</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 cyber-dark rounded">
                  <div className="text-cyan-400 font-medium">
                    {(user as any)?.remainingIncidents || 0}
                  </div>
                  <div className="text-gray-400">Remaining</div>
                </div>
                <div className="p-2 cyber-dark rounded">
                  <div className="text-green-400 font-medium">
                    {((storageData as any)?.limit || 0)} GB
                  </div>
                  <div className="text-gray-400">Storage</div>
                </div>
              </div>
              
              <p className="text-xs text-gray-400">
                Full access to all features
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage Usage Details */}
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyber-blue" />
            Storage Usage Details
          </CardTitle>
          <CardDescription>
            Detailed breakdown of your database storage usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Storage Overview</h4>
              <div className="space-y-3">
                <div className="flex justify-between p-3 cyber-dark rounded-lg">
                  <span className="text-sm text-gray-400">Total Storage Used:</span>
                  <span className="font-medium text-cyber-blue">
                    {((storageData as any)?.usage?.details?.totalMB || 0).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex justify-between p-3 cyber-dark rounded-lg">
                  <span className="text-sm text-gray-400">Storage Limit:</span>
                  <span className="font-medium text-green-400">{((storageData as any)?.limit || 0)} GB</span>
                </div>
                <div className="flex justify-between p-3 cyber-dark rounded-lg">
                  <span className="text-sm text-gray-400">Incidents Stored:</span>
                  <span className="font-medium">{((storageData as any)?.usage?.incidentCount || 0)}</span>
                </div>
                <div className="flex justify-between p-3 cyber-dark rounded-lg">
                  <span className="text-sm text-gray-400">Average per Incident:</span>
                  <span className="font-medium">{((storageData as any)?.usage?.details?.averageIncidentSizeMB || 0).toFixed(2)} MB</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Storage Breakdown</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(storageData as any)?.usage?.details?.breakdownMB && Object.entries((storageData as any).usage.details.breakdownMB).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex justify-between p-2 cyber-dark rounded text-xs">
                    <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span className="text-cyber-blue">{(value || 0).toFixed(2)} MB</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-gradient-to-r from-cyber-dark to-cyber-slate-dark rounded-lg border border-cyber-slate-light">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-cyber-blue flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-cyber-blue">Auto-Cleanup Policy</p>
                <p className="text-xs text-gray-400 mt-1">
                  All incidents are automatically deleted after 30 days across all plans to optimize storage usage and ensure data freshness.
                </p>
                <div className="mt-2 p-2 bg-cyber-slate-dark rounded border-l-2 border-yellow-500">
                  <p className="text-xs text-yellow-400">
                    <strong>Next Cleanup:</strong> {((cleanupData as any)?.incidentsToBeDeleted || 0)} incidents will be deleted tomorrow
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Incidents older than 30 days are automatically removed to optimize storage
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Information */}
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <CardTitle>Pricing Information</CardTitle>
          <CardDescription>Transparent pricing for all services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 cyber-dark rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="text-blue-500" />
                <h4 className="font-semibold">Incident Analysis</h4>
              </div>
              <p className="text-2xl font-bold">€{(() => {
                const currentPackage = (user as any)?.currentPackage || 'starter';
                const packagePricing = {
                  starter: '25',
                  professional: '23.75',
                  business: '22.50',
                  enterprise: '20'
                };
                return packagePricing[currentPackage as keyof typeof packagePricing] || '25';
              })()}</p>
              <p className="text-sm text-gray-400">per incident ({(user as any)?.currentPackage || 'starter'} plan)</p>
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
              <Elements stripe={stripePromise} key="stripe-elements">
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