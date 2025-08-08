// Query helper functions for Advanced Query functionality

// Convert KQL (Kusto Query Language) to SQL
export function convertKQLToSQL(kqlQuery: string, userId: string): string {
  // Basic KQL to SQL conversion
  let sqlQuery = kqlQuery.trim();
  
  // Handle table name at the beginning (KQL format: TableName | where ...)
  if (!sqlQuery.toLowerCase().startsWith('select') && !sqlQuery.includes('|')) {
    // If it starts with a table name, convert to SQL format
    sqlQuery = `incidents | ${sqlQuery}`;
  }
  
  // Replace pipe operator with proper SQL structure
  if (sqlQuery.includes('|')) {
    const parts = sqlQuery.split('|').map(p => p.trim());
    const tableName = parts[0];
    const operations = parts.slice(1).join(' ');
    sqlQuery = operations;
    
    // We'll add FROM clause later
    if (!sqlQuery.toLowerCase().includes('from')) {
      sqlQuery = sqlQuery + ` FROM ${tableName}`;
    }
  }
  
  // Handle common KQL operators
  sqlQuery = sqlQuery
    .replace(/\bproject\b/gi, 'SELECT')
    .replace(/\bwhere\b/gi, 'WHERE')
    .replace(/\bextend\b/gi, 'SELECT *, ')
    .replace(/\bsummarize\b/gi, 'SELECT')
    .replace(/\bby\b/gi, 'GROUP BY')
    .replace(/\btake\b\s+(\d+)/gi, 'LIMIT $1')
    .replace(/\btop\b\s+(\d+)/gi, 'LIMIT $1')
    .replace(/\bsort\s+by\b/gi, 'ORDER BY')
    .replace(/\b==\b/g, '=')
    .replace(/\b!=\b/g, '<>')
    .replace(/\bcontains\b/gi, 'LIKE')
    .replace(/\bstartswith\b/gi, 'LIKE')
    .replace(/\bendswith\b/gi, 'LIKE')
    .replace(/\band\b/gi, 'AND')
    .replace(/\bor\b/gi, 'OR')
    .replace(/\bnot\b/gi, 'NOT');
  
  // Handle table references
  if (!sqlQuery.toLowerCase().includes('from')) {
    // If no FROM clause, assume incidents table
    const selectIndex = sqlQuery.toLowerCase().indexOf('select');
    const whereIndex = sqlQuery.toLowerCase().indexOf('where');
    
    if (selectIndex !== -1) {
      if (whereIndex !== -1) {
        sqlQuery = sqlQuery.slice(0, whereIndex) + ' FROM incidents ' + sqlQuery.slice(whereIndex);
      } else {
        const limitIndex = sqlQuery.toLowerCase().indexOf('limit');
        const orderIndex = sqlQuery.toLowerCase().indexOf('order');
        let insertPoint = sqlQuery.length;
        
        if (limitIndex !== -1) insertPoint = Math.min(insertPoint, limitIndex);
        if (orderIndex !== -1) insertPoint = Math.min(insertPoint, orderIndex);
        
        sqlQuery = sqlQuery.slice(0, insertPoint) + ' FROM incidents ' + sqlQuery.slice(insertPoint);
      }
    } else {
      sqlQuery = 'SELECT * FROM incidents WHERE ' + sqlQuery;
    }
  }
  
  // The user_id filter will be added automatically by executeRawQuery for security
  // So we don't need to add it here to avoid duplication
  
  // Handle LIKE patterns
  sqlQuery = sqlQuery.replace(/LIKE\s+'([^']+)'/gi, (match, p1) => {
    if (!p1.includes('%')) {
      return `LIKE '%${p1}%'`;
    }
    return match;
  });
  
  return sqlQuery;
}

// Get helpful error hints for query failures
export function getQueryErrorHint(errorMessage: string): string {
  const lowerError = errorMessage.toLowerCase();
  
  if (lowerError.includes('syntax')) {
    return 'Check your query syntax. For KQL, use operators like: where, project, take, sort by. For SQL, ensure proper SELECT, FROM, WHERE structure.';
  }
  
  if (lowerError.includes('column') || lowerError.includes('field')) {
    return 'Available fields: title, severity, status, classification, confidence, createdAt, updatedAt. Use exact field names.';
  }
  
  if (lowerError.includes('permission') || lowerError.includes('denied')) {
    return 'You can only query your own incidents. The system automatically filters results by your user ID.';
  }
  
  if (lowerError.includes('timeout')) {
    return 'Query took too long to execute. Try simplifying your query or adding limits.';
  }
  
  return 'Ensure your query syntax is correct. For help, check the query examples in the interface.';
}