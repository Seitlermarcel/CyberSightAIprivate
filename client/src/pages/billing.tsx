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
  Shield,
  Zap,
  Globe,
  Users,
  Star,
  Award,
} from "lucide-react";
import { format } from "date-fns";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
// Validate that we're not using a secret key (which starts with sk_)
const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY || "";
const isValidPublishableKey = stripeKey.startsWith("pk_");
const stripePromise = isValidPublishableKey ? loadStripe(stripeKey) : null;

// Utility function to properly capitalize package names
const formatPackageName = (packageName: string) => {
  const packageNames: Record<string, string> = {
    starter: 'Starter Package',
    professional: 'Professional Package',
    business: 'Business Package',
    enterprise: 'Enterprise Package'
  };
  return packageNames[packageName] || 'Starter Package';
};

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
    } catch (error: any) {
      // Handle backend validation errors for package switching
      let errorTitle = "Purchase Failed";
      let errorMessage = "Unable to complete the purchase. Please try again.";
      
      try {
        if (error.response) {
          const errorData = await error.response.json();
          if (errorData?.error === "Package switch not allowed") {
            errorTitle = "Package Switch Restricted";
            errorMessage = errorData.message;
          }
        }
      } catch (parseError) {
        // Use default error message if JSON parsing fails
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
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
      case "incident-analysis": return <Activity className="text-red-500" />;
      case "storage-fee": return <Database className="text-orange-500" />;
      case "refund": return <DollarSign className="text-purple-500" />;
      default: return <DollarSign className="text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "credit-purchase": return "text-green-500";
      case "incident-analysis": return "text-red-500";
      case "storage-fee": return "text-orange-500";
      case "refund": return "text-purple-500";
      default: return "text-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-6 space-y-8">
      {/* Header Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-cyber-blue/20 to-purple-600/20 rounded-2xl blur-xl"></div>
        <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-cyber-blue to-purple-600 rounded-xl">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Billing & Subscription
              </h1>
              <p className="text-gray-400 mt-1">Manage your cybersecurity analysis platform</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Remaining Analyses Card */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
          <Card className="relative bg-slate-800/70 backdrop-blur-sm border border-slate-700/50 hover:border-emerald-500/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Analysis Credits
                </span>
                <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl">
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-baseline space-x-2">
                  <div className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    {(user as any)?.remainingIncidents || 0}
                  </div>
                  <div className="text-sm text-gray-400">remaining</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Package</span>
                    <span className="text-emerald-400 font-medium">
                      {formatPackageName((user as any)?.currentPackage || 'starter')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Used this month</span>
                    <span className="text-cyan-400 font-medium">
                      {(usage as any)?.incidentsAnalyzed || 0}
                    </span>
                  </div>
                </div>
                <Button 
                  className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white border-0 font-medium transition-all duration-300"
                  onClick={() => setShowPurchaseDialog(true)}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Upgrade Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Usage Analytics Card */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
          <Card className="relative bg-slate-800/70 backdrop-blur-sm border border-slate-700/50 hover:border-purple-500/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Usage Analytics
                </span>
                <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                    <div className="text-2xl font-bold text-purple-400">
                      {(usage as any)?.incidentsAnalyzed || 0}
                    </div>
                    <div className="text-xs text-gray-400">Incidents</div>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                    <div className="text-2xl font-bold text-pink-400">
                      {((storageData as any)?.usage?.details?.totalMB || 0).toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-400">MB Used</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Storage Usage</span>
                    <span className="text-purple-400 font-medium">
                      {((storageData as any)?.quota?.percentage || 0).toFixed(4)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.max(0.01, ((storageData as any)?.quota?.percentage || 0))} 
                    className="h-2 bg-slate-700/50" 
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {((storageData as any)?.quota?.percentage || 0) < 75 ? 'Optimal usage' : 
                       ((storageData as any)?.quota?.percentage || 0) < 90 ? 'High usage' : 'Critical usage'}
                    </span>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ((storageData as any)?.quota?.canCreateNew) 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {((storageData as any)?.quota?.canCreateNew ? 'Available' : 'Near Limit')}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gradient-to-r from-slate-800/60 to-slate-700/60 rounded-xl border border-slate-600/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Package Type</span>
                    <span className="text-sm font-medium bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {formatPackageName((user as any)?.currentPackage || 'starter')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Quota-based system • No overage fees
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Package Card */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
          <Card className="relative bg-slate-800/70 backdrop-blur-sm border border-slate-700/50 hover:border-blue-500/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Active Package
                </span>
                <div className="p-2 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl">
                  <Package className="w-5 h-5 text-blue-400" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className="text-sm px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
                    {formatPackageName((user as any)?.currentPackage || "starter")}
                  </Badge>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-green-400">Active</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                    <div className="text-2xl font-bold text-blue-400">
                      {(user as any)?.remainingIncidents || 0}
                    </div>
                    <div className="text-xs text-gray-400">Credits Left</div>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                    <div className="text-2xl font-bold text-indigo-400">
                      {((storageData as any)?.limit || 0)}
                    </div>
                    <div className="text-xs text-gray-400">GB Storage</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex flex-col items-center space-y-1 p-2 bg-slate-900/30 rounded-lg">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span className="text-gray-400">AI Analysis</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1 p-2 bg-slate-900/30 rounded-lg">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-400">Real-time</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1 p-2 bg-slate-900/30 rounded-lg">
                    <Globe className="w-4 h-4 text-purple-400" />
                    <span className="text-gray-400">SIEM API</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1 p-2 bg-slate-900/30 rounded-lg">
                    <Users className="w-4 h-4 text-orange-400" />
                    <span className="text-gray-400">Multi-tenant</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1 p-2 bg-slate-900/30 rounded-lg">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span className="text-gray-400">Threat Intel</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1 p-2 bg-slate-900/30 rounded-lg">
                    <Award className="w-4 h-4 text-cyan-400" />
                    <span className="text-gray-400">MITRE</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Storage Usage Details */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-blue-500/10 rounded-2xl blur-xl"></div>
        <Card className="relative bg-slate-800/70 backdrop-blur-sm border border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-teal-500/20 to-blue-500/20 rounded-xl">
                <Database className="w-6 h-6 text-teal-400" />
              </div>
              <span className="bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">
                Storage Analytics
              </span>
            </CardTitle>
            <CardDescription className="text-gray-400 ml-11">
              Real-time database storage monitoring and insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h4 className="text-lg font-semibold bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">Storage Overview</h4>
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-xl border border-slate-600/30">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Total Usage</span>
                      <span className="text-xl font-bold text-teal-400">
                        {((storageData as any)?.usage?.details?.totalMB || 0).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-xl border border-slate-600/30">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Storage Limit</span>
                      <span className="text-xl font-bold text-green-400">{((storageData as any)?.limit || 0)} GB</span>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-xl border border-slate-600/30">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Incidents Stored</span>
                      <span className="text-xl font-bold text-blue-400">{((storageData as any)?.usage?.incidentCount || 0)}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-xl border border-slate-600/30">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Avg per Incident</span>
                      <span className="text-xl font-bold text-purple-400">{((storageData as any)?.usage?.details?.averageIncidentSizeMB || 0).toFixed(2)} MB</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <h4 className="text-lg font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Data Breakdown</h4>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 max-h-80 overflow-y-auto">
                  <div className="space-y-3">
                    {(storageData as any)?.usage?.details?.breakdownMB && Object.entries((storageData as any).usage.details.breakdownMB).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-600/20">
                        <span className="text-gray-300 capitalize text-sm font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-purple-400 font-bold">{(value || 0).toFixed(2)} MB</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            
            <div className="lg:col-span-2 mt-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl blur-sm"></div>
                <div className="relative p-6 bg-slate-800/70 backdrop-blur-sm rounded-xl border border-orange-500/30">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl">
                      <Clock className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <h5 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mb-3">
                        Auto-Cleanup System
                      </h5>
                      <p className="text-gray-300 mb-4 leading-relaxed">
                        Advanced automated data retention policy ensures optimal performance and compliance across all subscription tiers.
                      </p>
                      <div className="p-4 bg-gradient-to-r from-slate-900/60 to-slate-800/60 rounded-lg border border-orange-500/30 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-1.5 bg-yellow-500/20 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                          </div>
                          <span className="font-semibold text-yellow-400">Scheduled Cleanup</span>
                        </div>
                        <p className="text-sm text-gray-300 mb-2">
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-md font-bold">
                            {((cleanupData as any)?.incidentsToBeDeleted || 0)} incidents
                          </span> will be automatically removed in the next cleanup cycle
                        </p>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Data older than 30 days is automatically purged to maintain system performance and storage efficiency
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing & Features Information */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-2xl blur-xl"></div>
        <Card className="relative bg-slate-800/70 backdrop-blur-sm border border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl">
                <Info className="w-6 h-6 text-orange-400" />
              </div>
              <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                Pricing & Features
              </span>
            </CardTitle>
            <CardDescription className="text-gray-400 ml-11">
              Transparent cybersecurity analysis pricing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Activity className="w-6 h-6 text-blue-400" />
                  </div>
                  <h4 className="font-semibold text-white">Analysis Cost</h4>
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    €{(() => {
                      const currentPackage = (user as any)?.currentPackage || 'starter';
                      const packagePricing = {
                        starter: '25.00',
                        professional: '23.75',
                        business: '22.50',
                        enterprise: '20.00'
                      };
                      return packagePricing[currentPackage as keyof typeof packagePricing] || '25.00';
                    })()}
                  </p>
                  <p className="text-sm text-gray-400">per incident analysis</p>
                  <p className="text-xs text-blue-400 font-medium">
                    {formatPackageName((user as any)?.currentPackage || 'starter')}
                  </p>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Clock className="w-6 h-6 text-green-400" />
                  </div>
                  <h4 className="font-semibold text-white">Data Retention</h4>
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                    30 Days
                  </p>
                  <p className="text-sm text-gray-400">automatic retention</p>
                  <p className="text-xs text-green-400 font-medium">
                    Auto-cleanup system
                  </p>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Database className="w-6 h-6 text-purple-400" />
                  </div>
                  <h4 className="font-semibold text-white">Storage Model</h4>
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Quota
                  </p>
                  <p className="text-sm text-gray-400">based system</p>
                  <p className="text-xs text-purple-400 font-medium">
                    No overage fees
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl blur-xl"></div>
        <Card className="relative bg-slate-800/70 backdrop-blur-sm border border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl">
                <Calendar className="w-6 h-6 text-indigo-400" />
              </div>
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Transaction History
              </span>
            </CardTitle>
            <CardDescription className="text-gray-400 ml-11">
              Complete financial activity log
            </CardDescription>
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
      </div>

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
                } ${
                  // Visually indicate if package switch is not allowed
                  (() => {
                    const remainingAnalyses = (user as any)?.remainingIncidents || 0;
                    const currentPackage = (user as any)?.currentPackage;
                    const isDifferentPackage = currentPackage && currentPackage !== pkg.id;
                    return remainingAnalyses > 0 && isDifferentPackage ? "opacity-50" : "";
                  })()
                }`}
                onClick={() => {
                  setSelectedPackage(pkg);
                  // Check if this is a different package and user has remaining analyses
                  const remainingAnalyses = (user as any)?.remainingIncidents || 0;
                  const currentPackage = (user as any)?.currentPackage;
                  const isDifferentPackage = currentPackage && currentPackage !== pkg.id;
                  
                  if (remainingAnalyses > 0 && isDifferentPackage) {
                    toast({
                      title: "Package Switch Restricted",
                      description: `You have ${remainingAnalyses} remaining analyses from your ${formatPackageName(currentPackage)} package. Use all analyses before switching to ${pkg.name}.`,
                      variant: "destructive",
                    });
                  }
                }}
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
                  
                  {/* Package availability status */}
                  {(() => {
                    const remainingAnalyses = (user as any)?.remainingIncidents || 0;
                    const currentPackage = (user as any)?.currentPackage;
                    const isSamePackage = currentPackage === pkg.id;
                    const isDifferentPackage = currentPackage && currentPackage !== pkg.id;
                    
                    if (remainingAnalyses > 0 && isDifferentPackage) {
                      return (
                        <div className="mt-2 px-2 py-1 bg-red-900/30 border border-red-700 rounded text-xs text-red-400">
                          ⚠️ Use all {remainingAnalyses} remaining analyses first
                        </div>
                      );
                    } else if (isSamePackage) {
                      return (
                        <div className="mt-2 px-2 py-1 bg-green-900/30 border border-green-700 rounded text-xs text-green-400">
                          ✅ Add {pkg.incidentsIncluded} more analyses
                        </div>
                      );
                    } else {
                      return (
                        <div className="mt-2 px-2 py-1 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-400">
                          🎯 Switch to this package
                        </div>
                      );
                    }
                  })()}
                  
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
                  {/* Only show development mode purchase option to authorized developer */}
                  {(user as any)?.id === '46095879' && (
                    <Button 
                      className="cyber-blue hover:bg-blue-600"
                      disabled={!selectedPackage}
                      onClick={async () => {
                        if (selectedPackage) {
                          try {
                            const result = await apiRequest("POST", "/api/billing/create-payment-intent", { packageId: selectedPackage.id });
                            const data = await result.json();
                            if (data.devMode && (user as any)?.id === '46095879') {
                              handlePurchaseSuccess();
                              toast({
                                title: "Development Mode",
                                description: data.message,
                              });
                            } else if (data.devMode && (user as any)?.id !== '46095879') {
                              // Unauthorized user trying to access dev mode - show error
                              toast({
                                title: "Payment Required",
                                description: "Please complete payment through Stripe to purchase this package.",
                                variant: "destructive",
                              });
                            }
                          } catch (error: any) {
                            // Handle backend validation errors for package switching
                            let errorTitle = "Purchase Failed";
                            let errorMessage = "Unable to complete the purchase.";
                            
                            try {
                              const response = await fetch(error.url, error.options);
                              const errorData = await response.json();
                              if (errorData?.error === "Package switch not allowed") {
                                errorTitle = "Package Switch Restricted";
                                errorMessage = errorData.message;
                              }
                            } catch (parseError) {
                              // Use default error message if JSON parsing fails
                            }
                            
                            toast({
                              title: errorTitle,
                              description: errorMessage,
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                    >
                      Purchase {selectedPackage?.name} (Dev Mode)
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}