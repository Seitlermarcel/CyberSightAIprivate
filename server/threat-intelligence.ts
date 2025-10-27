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
  // Enhanced fields for detailed analysis
  hash_type?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  url_status?: string;
  domain_registrar?: string;
  creation_date?: string;
  whois_data?: any;
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

  // Extract IOCs from log data (filtering out user accounts and time data)
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

    // Extract IP addresses (real IPs only, not user accounts)
    const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const ips = logData.match(ipRegex) || [];
    iocs.ips = Array.from(new Set(ips)).filter(ip => !this.isPrivateIP(ip) && this.isValidPublicIP(ip));

    // Extract domains (real domains only, not user accounts or time strings)
    const domainRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\b/gi;
    const domains = logData.match(domainRegex) || [];
    iocs.domains = Array.from(new Set(domains)).filter(d => 
      !this.isCommonDomain(d) && 
      !this.isUserAccount(d) && 
      !this.isTimeData(d) &&
      this.isValidDomain(d)
    );

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

  // Filter out user accounts (not IOCs)
  private isUserAccount(input: string): boolean {
    // Check for common user account patterns
    const userAccountPatterns = [
      /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,  // Email addresses
      /^[a-zA-Z0-9._-]+$/,                                // Simple usernames
      /^user\d+/i,                                        // user1, user2, etc.
      /^admin/i,                                          // admin accounts
      /^root$/i,                                          // root account
      /^guest/i,                                          // guest accounts
      /^service/i,                                        // service accounts
      /^system/i                                          // system accounts
    ];
    
    return userAccountPatterns.some(pattern => pattern.test(input));
  }

  // Filter out time-related data
  private isTimeData(input: string): boolean {
    const timePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,                             // Date format YYYY-MM-DD
      /^\d{2}:\d{2}:\d{2}$/,                             // Time format HH:MM:SS
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,           // ISO datetime
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, // Month names
      /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, // Day names
      /^\d{10}$/,                                        // Unix timestamp (10 digits)
      /^\d{13}$/,                                        // Unix timestamp (13 digits, milliseconds)
      /^(am|pm)$/i                                       // AM/PM
    ];
    
    return timePatterns.some(pattern => pattern.test(input));
  }

  // Validate public IP addresses
  private isValidPublicIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    
    // Check if all parts are valid numbers (0-255)
    if (parts.length !== 4 || parts.some(part => isNaN(part) || part < 0 || part > 255)) {
      return false;
    }

    // Exclude broadcast, multicast, and reserved ranges
    if (parts[0] === 0 || parts[0] >= 224 || 
        (parts[0] === 169 && parts[1] === 254) || // APIPA range
        parts.join('.') === '255.255.255.255') {
      return false;
    }

    return true;
  }

  // Validate domain names
  private isValidDomain(domain: string): boolean {
    // Must contain at least one dot
    if (!domain.includes('.')) return false;
    
    // Must have valid TLD (at least 2 characters)
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) return false;
    
    // Cannot start or end with dot or hyphen
    if (domain.startsWith('.') || domain.endsWith('.') || 
        domain.startsWith('-') || domain.endsWith('-')) return false;
    
    // Must contain only valid characters
    if (!/^[a-z0-9.-]+$/i.test(domain)) return false;
    
    // Cannot be longer than 253 characters
    if (domain.length > 253) return false;
    
    return true;
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
        tags: data.pulse_info?.pulses?.[0]?.tags || [],
        hash_type: hashType,
        file_name: data.file_name || data.filename,
        file_size: data.file_size || data.size,
        file_type: data.file_type || data.type,
        first_seen: data.first_seen,
        last_seen: data.last_seen
      };
    } catch (error) {
      console.error(`Error checking hash ${hash}:`, error);
      return this.getMockHashReputation(hash);
    }
  }

  private getMockHashReputation(hash: string): ThreatIndicator {
    const isMalicious = hash.startsWith('bad') || Math.random() > 0.7;
    const hashType = hash.length === 32 ? 'MD5' : hash.length === 40 ? 'SHA1' : 'SHA256';
    
    return {
      type: 'hash',
      value: hash,
      malicious: isMalicious,
      pulse_count: isMalicious ? Math.floor(Math.random() * 100) + 20 : 0,
      threat_score: isMalicious ? 90 : 0,
      tags: isMalicious ? ['trojan', 'ransomware', 'backdoor'] : [],
      hash_type: hashType,
      file_name: isMalicious ? 'malware.exe' : 'document.pdf',
      file_size: Math.floor(Math.random() * 10000000) + 1000,
      file_type: isMalicious ? 'PE32 executable' : 'PDF document'
    };
  }

  // Check URL reputation with enhanced details
  private async checkURLReputation(url: string): Promise<ThreatIndicator> {
    if (!this.apiKey) {
      return this.getMockURLReputation(url);
    }

    try {
      const response = await fetch(`${OTX_API_BASE}/indicators/url/${encodeURIComponent(url)}/general`, {
        headers: {
          'X-OTX-API-KEY': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`OTX API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract domain from URL for geo-location
      let country = data.country || data.country_name;
      let organization = data.org || data.organization;
      
      try {
        const urlObj = new URL(url);
        if (!country || !organization) {
          // Could potentially do domain lookup here if needed
        }
      } catch (e) {
        // Invalid URL format
      }
      
      return {
        type: 'url',
        value: url,
        malicious: data.pulse_info?.count > 0,
        pulse_count: data.pulse_info?.count || 0,
        threat_score: this.calculateThreatScore(data),
        tags: data.pulse_info?.pulses?.[0]?.tags || [],
        url_status: data.status || 'Unknown',
        country: country,
        organization: organization,
        first_seen: data.first_seen,
        last_seen: data.last_seen
      };
    } catch (error) {
      console.error(`Error checking URL ${url}:`, error);
      return this.getMockURLReputation(url);
    }
  }

  private getMockURLReputation(url: string): ThreatIndicator {
    const isMalicious = url.includes('malware') || url.includes('phish') || url.includes('hack') || Math.random() > 0.8;
    
    return {
      type: 'url',
      value: url,
      malicious: isMalicious,
      pulse_count: isMalicious ? Math.floor(Math.random() * 50) + 10 : 0,
      threat_score: isMalicious ? 85 : 10,
      tags: isMalicious ? ['malicious-url', 'phishing', 'malware-download'] : [],
      url_status: isMalicious ? 'Malicious' : 'Clean',
      country: isMalicious ? 'Russia' : 'United States',
      organization: isMalicious ? 'Unknown Hosting' : 'Cloudflare'
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
    console.log('🔍 Starting threat intelligence analysis...');
    console.log('📝 Log data length:', logData.length);
    console.log('🔑 OTX API key available:', !!this.apiKey);
    
    // Extract IOCs from logs
    const iocs = this.extractIOCs(logData + (additionalContext || ''));
    console.log('📊 Extracted IOCs:', {
      ips: iocs.ips.length,
      domains: iocs.domains.length,
      hashes: iocs.hashes.length,
      urls: iocs.urls.length,
      cves: iocs.cves.length
    });
    
    const indicators: ThreatIndicator[] = [];
    
    // Check IP reputations
    for (const ip of iocs.ips.slice(0, 10)) { // Limit to 10 IPs
      const indicator = await this.checkIPReputation(ip);
      indicators.push(indicator);
      console.log(`✅ IP ${ip}: threat_score=${indicator.threat_score}, malicious=${indicator.malicious}`);
    }
    
    // Check domain reputations
    for (const domain of iocs.domains.slice(0, 10)) { // Limit to 10 domains
      const indicator = await this.checkDomainReputation(domain);
      indicators.push(indicator);
      console.log(`✅ Domain ${domain}: threat_score=${indicator.threat_score}, malicious=${indicator.malicious}`);
    }
    
    // Check hash reputations
    for (const hash of iocs.hashes.slice(0, 5)) { // Limit to 5 hashes
      const indicator = await this.checkHashReputation(hash);
      indicators.push(indicator);
      console.log(`✅ Hash ${hash}: threat_score=${indicator.threat_score}, malicious=${indicator.malicious}`);
    }
    
    // Check URL reputations
    for (const url of iocs.urls.slice(0, 5)) { // Limit to 5 URLs
      const indicator = await this.checkURLReputation(url);
      indicators.push(indicator);
      console.log(`✅ URL ${url}: threat_score=${indicator.threat_score}, malicious=${indicator.malicious}`);
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
    
    const report = {
      indicators,
      risk_score: Math.round(riskScore),
      threat_level: this.calculateRiskLevel(riskScore),
      summary: this.generateSummary(indicators, iocs),
      recommendations,
      iocs
    };
    
    console.log('📈 Threat intelligence report generated:', {
      risk_score: report.risk_score,
      threat_level: report.threat_level,
      indicator_count: indicators.length,
      malicious_count: maliciousIndicators.length
    });
    
    return report;
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