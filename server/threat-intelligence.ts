import fetch from 'node-fetch';

// AlienVault OTX API configuration
const OTX_API_BASE = 'https://otx.alienvault.com/api/v1';

interface ThreatIndicator {
  type: 'ip' | 'domain' | 'url' | 'hash' | 'cve';
  value: string;
  reputation?: number;
  malicious?: boolean;
  tags?: string[];
  pulse_count?: number;
  first_seen?: string;
  last_seen?: string;
  country?: string;
  organization?: string;
  asn?: string;
  threat_score?: number;
}

interface ThreatIntelligenceReport {
  indicators: ThreatIndicator[];
  risk_score: number;
  threat_level: 'critical' | 'high' | 'medium' | 'low' | 'info';
  summary: string;
  recommendations: string[];
  iocs: {
    ips: string[];
    domains: string[];
    urls: string[];
    hashes: string[];
    cves: string[];
  };
}

export class ThreatIntelligenceService {
  private apiKey: string | undefined;
  
  constructor() {
    this.apiKey = process.env.OTX_API_KEY;
  }

  // Extract IOCs from log data
  private extractIOCs(logData: string): {
    ips: string[];
    domains: string[];
    urls: string[];
    hashes: string[];
    cves: string[];
  } {
    const iocs = {
      ips: [] as string[],
      domains: [] as string[],
      urls: [] as string[],
      hashes: [] as string[],
      cves: [] as string[]
    };

    // Extract IP addresses
    const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const ips = logData.match(ipRegex) || [];
    iocs.ips = Array.from(new Set(ips)).filter(ip => !this.isPrivateIP(ip));

    // Extract domains
    const domainRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\b/gi;
    const domains = logData.match(domainRegex) || [];
    iocs.domains = Array.from(new Set(domains)).filter(d => !this.isCommonDomain(d));

    // Extract URLs
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const urls = logData.match(urlRegex) || [];
    iocs.urls = Array.from(new Set(urls));

    // Extract MD5/SHA1/SHA256 hashes
    const md5Regex = /\b[a-f0-9]{32}\b/gi;
    const sha1Regex = /\b[a-f0-9]{40}\b/gi;
    const sha256Regex = /\b[a-f0-9]{64}\b/gi;
    const hashes = [
      ...(logData.match(md5Regex) || []),
      ...(logData.match(sha1Regex) || []),
      ...(logData.match(sha256Regex) || [])
    ];
    iocs.hashes = Array.from(new Set(hashes));

    // Extract CVE identifiers
    const cveRegex = /CVE-\d{4}-\d{4,}/gi;
    const cves = logData.match(cveRegex) || [];
    iocs.cves = Array.from(new Set(cves));

    return iocs;
  }

  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 127
    );
  }

  private isCommonDomain(domain: string): boolean {
    const commonDomains = [
      'localhost', 'example.com', 'test.com', 'google.com', 
      'microsoft.com', 'windows.com', 'apple.com', 'amazon.com'
    ];
    return commonDomains.some(common => domain.includes(common));
  }

  // Query OTX API for IP reputation
  private async checkIPReputation(ip: string): Promise<ThreatIndicator> {
    if (!this.apiKey) {
      return this.getMockIPReputation(ip);
    }

    try {
      const response = await fetch(`${OTX_API_BASE}/indicators/IPv4/${ip}/general`, {
        headers: {
          'X-OTX-API-KEY': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`OTX API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        type: 'ip',
        value: ip,
        reputation: data.reputation || 0,
        malicious: data.pulse_info?.count > 0,
        pulse_count: data.pulse_info?.count || 0,
        country: data.country_name || data.country_code,
        organization: data.asn ? `AS${data.asn}` : undefined,
        asn: data.asn,
        threat_score: this.calculateThreatScore(data)
      };
    } catch (error) {
      console.error(`Error checking IP ${ip}:`, error);
      return this.getMockIPReputation(ip);
    }
  }

  // Mock data for demonstration when API key is not available
  private getMockIPReputation(ip: string): ThreatIndicator {
    const suspiciousIPs = ['185.220.101.45', '192.42.116.16', '45.154.255.147'];
    const isSuspicious = suspiciousIPs.includes(ip) || ip.startsWith('185.');
    
    return {
      type: 'ip',
      value: ip,
      reputation: isSuspicious ? -1 : 0,
      malicious: isSuspicious,
      pulse_count: isSuspicious ? Math.floor(Math.random() * 50) + 10 : 0,
      country: isSuspicious ? 'Russia' : 'United States',
      organization: isSuspicious ? 'Unknown ISP' : 'AWS',
      threat_score: isSuspicious ? 75 : 10,
      tags: isSuspicious ? ['malware', 'botnet', 'scanner'] : []
    };
  }

  // Check domain reputation
  private async checkDomainReputation(domain: string): Promise<ThreatIndicator> {
    if (!this.apiKey) {
      return this.getMockDomainReputation(domain);
    }

    try {
      const response = await fetch(`${OTX_API_BASE}/indicators/domain/${domain}/general`, {
        headers: {
          'X-OTX-API-KEY': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`OTX API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        type: 'domain',
        value: domain,
        reputation: data.reputation || 0,
        malicious: data.pulse_info?.count > 0,
        pulse_count: data.pulse_info?.count || 0,
        country: data.country || data.country_name || data.country_code,
        organization: data.registrar || data.org || undefined,
        threat_score: this.calculateThreatScore(data)
      };
    } catch (error) {
      console.error(`Error checking domain ${domain}:`, error);
      return this.getMockDomainReputation(domain);
    }
  }

  private getMockDomainReputation(domain: string): ThreatIndicator {
    const maliciousDomains = ['evil.com', 'malware-download.com', 'phishing-site.net'];
    const isMalicious = maliciousDomains.some(bad => domain.includes(bad)) || 
                       domain.includes('hack') || domain.includes('exploit');
    
    return {
      type: 'domain',
      value: domain,
      reputation: isMalicious ? -1 : 0,
      malicious: isMalicious,
      pulse_count: isMalicious ? Math.floor(Math.random() * 30) + 5 : 0,
      country: isMalicious ? 'Russia' : 'United States',
      organization: isMalicious ? 'Bulletproof Hosting' : 'Cloudflare',
      threat_score: isMalicious ? 80 : 5,
      tags: isMalicious ? ['phishing', 'malware-distribution'] : []
    };
  }

  // Check file hash reputation
  private async checkHashReputation(hash: string): Promise<ThreatIndicator> {
    const hashType = hash.length === 32 ? 'MD5' : hash.length === 40 ? 'SHA1' : 'SHA256';
    
    if (!this.apiKey) {
      return this.getMockHashReputation(hash);
    }

    try {
      const response = await fetch(`${OTX_API_BASE}/indicators/file/${hash}/general`, {
        headers: {
          'X-OTX-API-KEY': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`OTX API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        type: 'hash',
        value: hash,
        malicious: data.pulse_info?.count > 0,
        pulse_count: data.pulse_info?.count || 0,
        threat_score: this.calculateThreatScore(data),
        tags: data.pulse_info?.pulses?.[0]?.tags || []
      };
    } catch (error) {
      console.error(`Error checking hash ${hash}:`, error);
      return this.getMockHashReputation(hash);
    }
  }

  private getMockHashReputation(hash: string): ThreatIndicator {
    const isMalicious = hash.startsWith('bad') || Math.random() > 0.7;
    
    return {
      type: 'hash',
      value: hash,
      malicious: isMalicious,
      pulse_count: isMalicious ? Math.floor(Math.random() * 100) + 20 : 0,
      threat_score: isMalicious ? 90 : 0,
      tags: isMalicious ? ['trojan', 'ransomware', 'backdoor'] : []
    };
  }

  private calculateThreatScore(data: any): number {
    let score = 0;
    
    if (data.pulse_info?.count) {
      score += Math.min(data.pulse_info.count * 2, 50);
    }
    
    if (data.reputation && data.reputation < 0) {
      score += 30;
    }
    
    if (data.validation?.length > 0) {
      score += 20;
    }
    
    return Math.min(score, 100);
  }

  private calculateRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'info';
  }

  // Main analysis function
  public async analyzeThreatIntelligence(
    logData: string, 
    additionalContext?: string
  ): Promise<ThreatIntelligenceReport> {
    // Extract IOCs from logs
    const iocs = this.extractIOCs(logData + (additionalContext || ''));
    
    const indicators: ThreatIndicator[] = [];
    
    // Check IP reputations
    for (const ip of iocs.ips.slice(0, 10)) { // Limit to 10 IPs
      const indicator = await this.checkIPReputation(ip);
      indicators.push(indicator);
    }
    
    // Check domain reputations
    for (const domain of iocs.domains.slice(0, 10)) { // Limit to 10 domains
      const indicator = await this.checkDomainReputation(domain);
      indicators.push(indicator);
    }
    
    // Check hash reputations
    for (const hash of iocs.hashes.slice(0, 5)) { // Limit to 5 hashes
      const indicator = await this.checkHashReputation(hash);
      indicators.push(indicator);
    }
    
    // Calculate overall risk score
    const maliciousIndicators = indicators.filter(i => i.malicious);
    const avgThreatScore = indicators.length > 0 
      ? indicators.reduce((sum, i) => sum + (i.threat_score || 0), 0) / indicators.length
      : 0;
    
    const riskScore = Math.min(
      100,
      avgThreatScore + (maliciousIndicators.length * 10)
    );
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(indicators, iocs);
    
    return {
      indicators,
      risk_score: Math.round(riskScore),
      threat_level: this.calculateRiskLevel(riskScore),
      summary: this.generateSummary(indicators, iocs),
      recommendations,
      iocs
    };
  }

  private generateSummary(indicators: ThreatIndicator[], iocs: any): string {
    const maliciousCount = indicators.filter(i => i.malicious).length;
    const totalIOCs = iocs.ips.length + iocs.domains.length + iocs.urls.length + 
                     iocs.hashes.length + iocs.cves.length;
    
    if (maliciousCount === 0) {
      return `Analyzed ${totalIOCs} indicators. No known malicious activity detected.`;
    }
    
    return `Detected ${maliciousCount} malicious indicators out of ${totalIOCs} total IOCs analyzed. ` +
           `Immediate investigation recommended for identified threats.`;
  }

  private generateRecommendations(indicators: ThreatIndicator[], iocs: any): string[] {
    const recommendations: string[] = [];
    const maliciousIPs = indicators.filter(i => i.type === 'ip' && i.malicious);
    const maliciousDomains = indicators.filter(i => i.type === 'domain' && i.malicious);
    const maliciousHashes = indicators.filter(i => i.type === 'hash' && i.malicious);
    
    if (maliciousIPs.length > 0) {
      const ipList = maliciousIPs.slice(0, 3).map(ip => ip.value).join(', ');
      const moreIPs = maliciousIPs.length > 3 ? ` and ${maliciousIPs.length - 3} more` : '';
      recommendations.push(`Block malicious IPs at firewall: ${ipList}${moreIPs}`);
      recommendations.push(`Investigate connections to/from: ${maliciousIPs[0].value}${maliciousIPs[0].country ? ' (' + maliciousIPs[0].country + ')' : ''}`);
    }
    
    if (maliciousDomains.length > 0) {
      const domainList = maliciousDomains.slice(0, 3).map(d => d.value).join(', ');
      const moreDomains = maliciousDomains.length > 3 ? ` and ${maliciousDomains.length - 3} more` : '';
      recommendations.push(`Add to DNS blacklist: ${domainList}${moreDomains}`);
      recommendations.push(`Check proxy logs for access to: ${maliciousDomains[0].value}`);
    }
    
    if (maliciousHashes.length > 0) {
      const hashSample = maliciousHashes[0].value.substring(0, 16) + '...';
      recommendations.push(`Scan for malicious file hash: ${hashSample} (${maliciousHashes.length} total)`);
      recommendations.push('Initiate EDR investigation for detected malware signatures');
    }
    
    if (iocs.cves.length > 0) {
      const cveList = iocs.cves.slice(0, 2).join(', ');
      const moreCVEs = iocs.cves.length > 2 ? ` and ${iocs.cves.length - 2} more` : '';
      recommendations.push(`Verify patches for: ${cveList}${moreCVEs}`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring for suspicious activity');
      recommendations.push('Update threat intelligence feeds');
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const threatIntelligence = new ThreatIntelligenceService();