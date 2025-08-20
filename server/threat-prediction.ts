import type { Incident } from '../shared/schema';

interface ThreatPredictionData {
  overallThreatLevel: number;
  confidence: number;
  riskTrend: 'increasing' | 'stable' | 'decreasing';
  predictions: {
    category: string;
    likelihood: number;
    timeframe: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
  }[];
  factors: {
    name: string;
    weight: number;
    contribution: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  recommendations: string[];
  lastUpdated: string;
}

export class ThreatPredictionEngine {
  
  /**
   * Generate AI-powered threat prediction based on historical incidents and current context
   */
  static generatePrediction(incidents: Incident[], currentContext?: string): ThreatPredictionData {
    const recentIncidents = incidents.filter(i => {
      const incidentDate = new Date(i.createdAt!);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return incidentDate >= thirtyDaysAgo;
    });

    // Calculate threat factors
    const factors = this.analyzeThreatFactors(incidents, recentIncidents);
    
    // Calculate overall threat level
    const overallThreatLevel = this.calculateOverallThreatLevel(factors, recentIncidents);
    
    // Determine risk trend
    const riskTrend = this.calculateRiskTrend(incidents);
    
    // Generate specific threat predictions
    const predictions = this.generateThreatPredictions(recentIncidents, factors);
    
    // Calculate confidence based on data quality and quantity
    const confidence = this.calculateConfidence(incidents, factors);
    
    // Generate AI recommendations
    const recommendations = this.generateRecommendations(overallThreatLevel, predictions, factors);

    return {
      overallThreatLevel: Math.round(overallThreatLevel),
      confidence: Math.round(confidence),
      riskTrend,
      predictions,
      factors,
      recommendations,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Analyze various threat factors from incident data
   */
  private static analyzeThreatFactors(allIncidents: Incident[], recentIncidents: Incident[]) {
    const factors = [];

    // Incident Volume Factor
    const avgIncidentsPerWeek = allIncidents.length / Math.max(1, this.getWeeksSinceOldest(allIncidents));
    const recentWeeklyAvg = recentIncidents.length / 4; // Last 4 weeks
    const volumeTrend: 'up' | 'down' | 'stable' = recentWeeklyAvg > avgIncidentsPerWeek ? 'up' : 
                       recentWeeklyAvg < avgIncidentsPerWeek ? 'down' : 'stable';
    
    factors.push({
      name: 'Incident Volume',
      weight: 25,
      contribution: Math.min(95, (recentWeeklyAvg / Math.max(1, avgIncidentsPerWeek)) * 50),
      trend: volumeTrend
    });

    // Severity Distribution Factor
    const criticalHighCount = recentIncidents.filter(i => 
      ['critical', 'high'].includes(i.severity?.toLowerCase() || '')
    ).length;
    const severityScore = (criticalHighCount / Math.max(1, recentIncidents.length)) * 100;
    
    factors.push({
      name: 'High Severity Incidents',
      weight: 30,
      contribution: Math.round(severityScore),
      trend: this.getSeverityTrend(allIncidents)
    });

    // False Positive Rate
    const falsePositives = recentIncidents.filter(i => 
      i.classification === 'false-positive'
    ).length;
    const fpRate = (falsePositives / Math.max(1, recentIncidents.length)) * 100;
    
    factors.push({
      name: 'Detection Accuracy',
      weight: 20,
      contribution: Math.round(100 - fpRate), // Higher is better
      trend: this.getFPTrend(allIncidents)
    });

    // MITRE ATT&CK Coverage
    const uniqueTechniques = new Set<string>();
    recentIncidents.forEach(i => {
      if (i.mitreAttack) {
        i.mitreAttack.forEach(technique => uniqueTechniques.add(technique));
      }
    });
    const mitreScore = Math.min(90, Array.from(uniqueTechniques).length * 10);
    
    factors.push({
      name: 'Attack Technique Diversity',
      weight: 15,
      contribution: Math.round(mitreScore),
      trend: this.getMitreTrend(allIncidents)
    });

    // Response Time Factor
    const avgConfidence = recentIncidents.reduce((acc, i) => acc + (i.confidence || 0), 0) / 
                         Math.max(1, recentIncidents.length);
    
    factors.push({
      name: 'AI Analysis Confidence',
      weight: 10,
      contribution: Math.round(avgConfidence),
      trend: this.getConfidenceTrend(allIncidents)
    });

    return factors;
  }

  /**
   * Calculate overall threat level based on weighted factors
   */
  private static calculateOverallThreatLevel(factors: any[], recentIncidents: Incident[]): number {
    const weightedScore = factors.reduce((acc, factor) => {
      return acc + (factor.contribution * factor.weight / 100);
    }, 0) / factors.reduce((acc, factor) => acc + factor.weight, 0) * 100;

    // Apply contextual modifiers
    let modifier = 1.0;
    
    // Recent critical incidents boost threat level
    const recentCritical = recentIncidents.filter(i => 
      i.severity === 'critical' && 
      new Date(i.createdAt!).getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000)
    ).length;
    
    if (recentCritical > 0) modifier += 0.2;
    
    // High true positive rate indicates real threats
    const truePositives = recentIncidents.filter(i => i.classification === 'true-positive').length;
    const tpRate = truePositives / Math.max(1, recentIncidents.length);
    if (tpRate > 0.7) modifier += 0.15;

    return Math.min(100, weightedScore * modifier);
  }

  /**
   * Calculate risk trend based on recent vs historical data
   */
  private static calculateRiskTrend(incidents: Incident[]): 'increasing' | 'stable' | 'decreasing' {
    if (incidents.length < 10) return 'stable';

    const now = new Date();
    const lastWeek = incidents.filter(i => {
      const date = new Date(i.createdAt!);
      return date.getTime() > now.getTime() - (7 * 24 * 60 * 60 * 1000);
    });

    const previousWeek = incidents.filter(i => {
      const date = new Date(i.createdAt!);
      return date.getTime() > now.getTime() - (14 * 24 * 60 * 60 * 1000) &&
             date.getTime() <= now.getTime() - (7 * 24 * 60 * 60 * 1000);
    });

    const lastWeekSeverity = this.calculateAverageSeverityScore(lastWeek);
    const prevWeekSeverity = this.calculateAverageSeverityScore(previousWeek);

    const difference = lastWeekSeverity - prevWeekSeverity;
    
    if (Math.abs(difference) < 0.5) return 'stable';
    return difference > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Generate specific threat predictions
   */
  private static generateThreatPredictions(recentIncidents: Incident[], factors: any[]) {
    const predictions = [];

    // Advanced Persistent Threat prediction
    const mitreComplexity = this.calculateMitreComplexity(recentIncidents);
    if (mitreComplexity > 3) {
      predictions.push({
        category: 'Advanced Persistent Threat (APT)',
        likelihood: Math.min(95, 40 + mitreComplexity * 10),
        timeframe: '7-14 days',
        description: 'Sophisticated, multi-stage attack targeting high-value assets with persistent access.',
        impact: mitreComplexity > 5 ? 'critical' : 'high'
      });
    }

    // Lateral Movement prediction
    const networkIndicators = recentIncidents.filter(i => 
      i.iocs?.some(ioc => ioc.includes('192.168') || ioc.includes('10.0') || ioc.includes('172.'))
    ).length;
    
    if (networkIndicators > 2) {
      predictions.push({
        category: 'Lateral Movement Attack',
        likelihood: Math.min(90, 30 + networkIndicators * 15),
        timeframe: '3-7 days',
        description: 'Attacker attempting to move laterally through network infrastructure.',
        impact: 'high' as const
      });
    }

    // Data Exfiltration prediction
    const dataThreats = recentIncidents.filter(i => 
      i.logData?.toLowerCase().includes('data') || 
      i.logData?.toLowerCase().includes('file') ||
      i.logData?.toLowerCase().includes('download')
    ).length;
    
    if (dataThreats > 1) {
      predictions.push({
        category: 'Data Exfiltration Attempt',
        likelihood: Math.min(85, 25 + dataThreats * 20),
        timeframe: '1-5 days',
        description: 'Potential unauthorized data access and exfiltration activities detected.',
        impact: 'critical' as const
      });
    }

    // Credential Compromise prediction
    const authFailures = recentIncidents.filter(i => 
      i.logData?.toLowerCase().includes('login') || 
      i.logData?.toLowerCase().includes('auth') ||
      i.logData?.toLowerCase().includes('password')
    ).length;
    
    if (authFailures > 2) {
      predictions.push({
        category: 'Credential Compromise',
        likelihood: Math.min(80, 35 + authFailures * 12),
        timeframe: '2-6 days',
        description: 'Multiple authentication anomalies suggest potential credential compromise.',
        impact: 'high' as const
      });
    }

    // Malware Deployment prediction
    const suspiciousActivity = recentIncidents.filter(i => 
      i.classification === 'true-positive' && 
      ['critical', 'high'].includes(i.severity?.toLowerCase() || '')
    ).length;
    
    if (suspiciousActivity > 1) {
      predictions.push({
        category: 'Malware Deployment',
        likelihood: Math.min(75, 20 + suspiciousActivity * 18),
        timeframe: '1-3 days',
        description: 'Pattern of high-confidence threats suggests possible malware activity.',
        impact: 'high' as const
      });
    }

    // Ensure we have at least one prediction
    if (predictions.length === 0) {
      predictions.push({
        category: 'General Security Event',
        likelihood: 35,
        timeframe: '7-14 days',
        description: 'Baseline security monitoring indicates normal threat levels.',
        impact: 'medium' as const
      });
    }

    return predictions.slice(0, 5); // Limit to top 5 predictions
  }

  /**
   * Calculate prediction confidence based on data quality
   */
  private static calculateConfidence(incidents: Incident[], factors: any[]): number {
    let confidence = 50; // Base confidence

    // More incidents = higher confidence
    if (incidents.length > 20) confidence += 20;
    else if (incidents.length > 10) confidence += 10;
    else if (incidents.length > 5) confidence += 5;

    // Recent data boost
    const recentCount = incidents.filter(i => {
      const date = new Date(i.createdAt!);
      return date.getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000);
    }).length;
    
    if (recentCount > 3) confidence += 15;
    else if (recentCount > 1) confidence += 10;

    // Classification accuracy boost
    const classified = incidents.filter(i => i.classification).length;
    const classificationRate = classified / Math.max(1, incidents.length);
    confidence += classificationRate * 15;

    // MITRE mapping boost
    const mitreIncidents = incidents.filter(i => i.mitreAttack?.length).length;
    const mitreRate = mitreIncidents / Math.max(1, incidents.length);
    confidence += mitreRate * 10;

    return Math.min(95, confidence);
  }

  /**
   * Generate AI-powered recommendations
   */
  private static generateRecommendations(threatLevel: number, predictions: any[], factors: any[]): string[] {
    const recommendations = [];

    // Threat level based recommendations
    if (threatLevel >= 80) {
      recommendations.push('Activate incident response team and implement enhanced monitoring protocols');
      recommendations.push('Consider threat hunting activities to identify advanced persistent threats');
      recommendations.push('Review and update security controls based on current threat landscape');
    } else if (threatLevel >= 60) {
      recommendations.push('Increase security monitoring frequency and alert sensitivity');
      recommendations.push('Conduct security awareness training for high-risk user groups');
      recommendations.push('Review access controls and implement principle of least privilege');
    } else if (threatLevel >= 40) {
      recommendations.push('Maintain current security posture with regular monitoring');
      recommendations.push('Update threat intelligence feeds and security signatures');
      recommendations.push('Schedule routine security assessments and penetration testing');
    } else {
      recommendations.push('Continue baseline security monitoring and maintenance');
      recommendations.push('Focus on preventive security measures and user education');
      recommendations.push('Review and optimize security tool configurations');
    }

    // Prediction-specific recommendations
    predictions.forEach(prediction => {
      switch (prediction.category) {
        case 'Advanced Persistent Threat (APT)':
          recommendations.push('Deploy advanced threat detection tools and behavioral analytics');
          break;
        case 'Lateral Movement Attack':
          recommendations.push('Implement network segmentation and micro-segmentation strategies');
          break;
        case 'Data Exfiltration Attempt':
          recommendations.push('Enable data loss prevention (DLP) tools and monitor data flows');
          break;
        case 'Credential Compromise':
          recommendations.push('Enforce multi-factor authentication and monitor privileged accounts');
          break;
        case 'Malware Deployment':
          recommendations.push('Update endpoint protection and implement application whitelisting');
          break;
      }
    });

    // Factor-specific recommendations
    factors.forEach(factor => {
      if (factor.contribution > 70 && factor.trend === 'up') {
        switch (factor.name) {
          case 'Incident Volume':
            recommendations.push('Investigate root causes of increasing incident volume');
            break;
          case 'High Severity Incidents':
            recommendations.push('Focus resources on critical vulnerability remediation');
            break;
          case 'Attack Technique Diversity':
            recommendations.push('Diversify security controls to address multiple attack vectors');
            break;
        }
      }
    });

    // Remove duplicates and limit recommendations
    const uniqueRecommendations = Array.from(new Set(recommendations));
    return uniqueRecommendations.slice(0, 6);
  }

  // Helper methods
  private static getWeeksSinceOldest(incidents: Incident[]): number {
    if (incidents.length === 0) return 1;
    const oldest = Math.min(...incidents.map(i => new Date(i.createdAt!).getTime()));
    const now = Date.now();
    return Math.max(1, Math.floor((now - oldest) / (7 * 24 * 60 * 60 * 1000)));
  }

  private static getSeverityTrend(incidents: Incident[]): 'up' | 'down' | 'stable' {
    if (incidents.length < 6) return 'stable';
    
    const recent = incidents.slice(-6);
    const older = incidents.slice(-12, -6);
    
    const recentSeverity = this.calculateAverageSeverityScore(recent);
    const olderSeverity = this.calculateAverageSeverityScore(older);
    
    const diff = recentSeverity - olderSeverity;
    if (Math.abs(diff) < 0.3) return 'stable';
    return diff > 0 ? 'up' : 'down';
  }

  private static getFPTrend(incidents: Incident[]): 'up' | 'down' | 'stable' {
    if (incidents.length < 6) return 'stable';
    
    const recent = incidents.slice(-6);
    const older = incidents.slice(-12, -6);
    
    const recentFP = recent.filter(i => i.classification === 'false-positive').length / recent.length;
    const olderFP = older.filter(i => i.classification === 'false-positive').length / Math.max(1, older.length);
    
    const diff = recentFP - olderFP;
    if (Math.abs(diff) < 0.1) return 'stable';
    return diff > 0 ? 'up' : 'down';
  }

  private static getMitreTrend(incidents: Incident[]): 'up' | 'down' | 'stable' {
    if (incidents.length < 6) return 'stable';
    
    const recent = incidents.slice(-6);
    const older = incidents.slice(-12, -6);
    
    const recentMitre = recent.filter(i => i.mitreAttack?.length).length / recent.length;
    const olderMitre = older.filter(i => i.mitreAttack?.length).length / Math.max(1, older.length);
    
    const diff = recentMitre - olderMitre;
    if (Math.abs(diff) < 0.1) return 'stable';
    return diff > 0 ? 'up' : 'down';
  }

  private static getConfidenceTrend(incidents: Incident[]): 'up' | 'down' | 'stable' {
    if (incidents.length < 6) return 'stable';
    
    const recent = incidents.slice(-6);
    const older = incidents.slice(-12, -6);
    
    const recentConf = recent.reduce((acc, i) => acc + (i.confidence || 0), 0) / recent.length;
    const olderConf = older.reduce((acc, i) => acc + (i.confidence || 0), 0) / Math.max(1, older.length);
    
    const diff = recentConf - olderConf;
    if (Math.abs(diff) < 5) return 'stable';
    return diff > 0 ? 'up' : 'down';
  }

  private static calculateAverageSeverityScore(incidents: Incident[]): number {
    if (incidents.length === 0) return 0;
    
    const severityScores = { critical: 4, high: 3, medium: 2, low: 1, informational: 0 };
    const total = incidents.reduce((acc, i) => {
      const score = severityScores[i.severity as keyof typeof severityScores] || 0;
      return acc + score;
    }, 0);
    
    return total / incidents.length;
  }

  private static calculateMitreComplexity(incidents: Incident[]): number {
    const uniqueTechniques = new Set<string>();
    incidents.forEach(i => {
      if (i.mitreAttack) {
        i.mitreAttack.forEach(technique => uniqueTechniques.add(technique));
      }
    });
    return Array.from(uniqueTechniques).length;
  }
}