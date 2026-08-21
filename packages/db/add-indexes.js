const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const indexesToAdd = {
  Order: [
    '@@index([tenantId, branchId, createdAt(sort: Desc)])',
    '@@index([tenantId, branchId, status])',
    '@@index([tenantId, status, createdAt(sort: Desc)])',
    '@@index([shiftId, status])',
    '@@index([tableId, status])',
    '@@index([cashierId, createdAt(sort: Desc)])',
    '@@index([customerId])',
    '@@index([source, tenantId])',
  ],
  User: [
    '@@index([tenantId, role])',
    '@@index([tenantId, branchId, role])',
    '@@index([email])',
    '@@index([tenantId, posPin])',
    '@@index([branchId, role, status])',
  ],
  Shift: [
    '@@index([tenantId, branchId, status])',
    '@@index([userId, status])',
    '@@index([tenantId, openedAt(sort: Desc)])',
    '@@index([branchId, openedAt(sort: Desc)])',
  ],
  Customer: [
    '@@index([tenantId, phone])',
    '@@index([tenantId, segment])',
    '@@index([tenantId, totalSpend(sort: Desc)])',
    '@@index([tenantId, lastVisitAt])',
  ],
  Item: [
    '@@index([tenantId, isAvailable])',
    '@@index([categoryId, isAvailable])',
  ],
  TenantBranding: [
    '@@index([tenantId])',
  ],
  Branch: [
    '@@index([tenantId, isActive])',
    '@@index([branchCode])',
  ],
  LoyaltyPointLedger: [
    '@@index([customerId, createdAt(sort: Desc)])',
    '@@index([tenantId, type])',
  ],
  Stock: [
    '@@index([branchId, ingredientId])',
    '@@index([branchId, quantity])',
  ],
  AnomalyEvent: [
    '@@index([tenantId, status, severity])',
    '@@index([branchId, detectedAt(sort: Desc)])',
  ]
};

// Extract field names from index string like '@@index([field1, field2(sort: Desc)])' -> ['field1', 'field2']
const getFields = (idxStr) => {
  const match = idxStr.match(/\[(.*?)\]/);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim().replace(/\(sort:.*?\)/, '')).join(',');
};

for (const [modelName, indexes] of Object.entries(indexesToAdd)) {
  const modelRegex = new RegExp(`(model ${modelName} \\{[\\s\\S]*?\\n)(\\})`, 'g');
  
  schema = schema.replace(modelRegex, (match, body, closing) => {
    let newBody = body;
    
    indexes.forEach(idx => {
      const fields = getFields(idx);
      // Remove any existing index with the exact same fields (ignoring sort direction)
      const existingRegex = new RegExp(`\\s*@@index\\(\\[${fields.replace(/,/g, '\\s*,\\s*')}.*?\\]\\)`, 'g');
      newBody = newBody.replace(existingRegex, '');
      
      // Append the new one
      newBody += `  ${idx}\n`;
    });
    
    return newBody + closing;
  });
}

fs.writeFileSync(schemaPath, schema);
console.log('Smart indexes added successfully!');
