// OAuth 2.0 Scope Management System

export const OAUTH_SCOPES = {
  // Basic read access
  read: {
    name: 'Read Access',
    description: 'Read your public profile, posts, and comments',
    icon: '👁️',
    category: 'basic',
    riskLevel: 'low'
  },

  // Wallet access (high risk)
  'wallet:read': {
    name: 'Read Wallet',
    description: 'View your wallet balance and transaction history',
    icon: '👀',
    category: 'wallet',
    riskLevel: 'medium'
  },
  'wallet:send': {
    name: 'Send Payments',
    description: 'Send payments from your wallet',
    icon: '⚡',
    category: 'wallet',
    riskLevel: 'high',
    requiresApproval: true
  },
  'wallet:receive': {
    name: 'Receive Payments',
    description: 'Create invoices and receive payments to your wallet',
    icon: '📥',
    category: 'wallet',
    riskLevel: 'low'
  },

  // Profile management
  'profile:read': {
    name: 'Read Profile',
    description: 'Access your profile information and settings',
    icon: '👤',
    category: 'profile',
    riskLevel: 'low'
  }
}

export const SCOPE_CATEGORIES = {
  basic: {
    name: 'Basic Access',
    description: 'Basic read access to public information',
    color: 'primary'
  },
  wallet: {
    name: 'Wallet Access',
    description: 'Access to wallet functions',
    color: 'warning'
  },
  profile: {
    name: 'Profile Management',
    description: 'Access to profile information',
    color: 'secondary'
  }
}

export function validateScopes (requestedScopes, availableScopes = null) {
  const available = availableScopes || Object.keys(OAUTH_SCOPES)
  const errors = []
  const validated = []

  for (const scope of requestedScopes) {
    if (!available.includes(scope)) {
      errors.push(`Invalid scope: ${scope}`)
    } else {
      validated.push(scope)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validatedScopes: validated
  }
}

export function getScopesByCategory (scopes) {
  const categorized = {}

  for (const scope of scopes) {
    const scopeInfo = OAUTH_SCOPES[scope]
    if (!scopeInfo) continue

    const category = scopeInfo.category
    if (!categorized[category]) {
      categorized[category] = []
    }
    categorized[category].push({
      scope,
      ...scopeInfo
    })
  }

  return categorized
}

export function getHighRiskScopes (scopes) {
  return scopes.filter(scope => {
    const scopeInfo = OAUTH_SCOPES[scope]
    return scopeInfo && scopeInfo.riskLevel === 'high'
  })
}

export function getScopesRequiringApproval (scopes) {
  return scopes.filter(scope => {
    const scopeInfo = OAUTH_SCOPES[scope]
    return scopeInfo && scopeInfo.requiresApproval
  })
}

export function checkScopePermission (userScopes, requiredScope) {
  // Check if user has the exact scope
  if (userScopes.includes(requiredScope)) {
    return true
  }

  // Check for implicit permissions (e.g., write:posts includes read)
  if (requiredScope === 'read') {
    // Any write scope implies read access
    return userScopes.some(scope => scope.startsWith('write:'))
  }

  if (requiredScope === 'profile:read') {
    // profile:write implies profile:read
    return userScopes.includes('profile:write')
  }

  if (requiredScope === 'wallet:read') {
    // wallet:send implies wallet:read
    return userScopes.includes('wallet:send')
  }

  return false
}

export function minimizeScopes (scopes) {
  // Remove redundant scopes based on hierarchy
  let minimized = [...scopes]

  // If wallet:send is present, remove wallet:read
  if (minimized.includes('wallet:send')) {
    minimized = minimized.filter(s => s !== 'wallet:read')
  }

  return minimized
}

export function expandScopes (scopes) {
  // Add implied scopes
  const expanded = new Set(scopes)

  // wallet:send includes wallet:read
  if (scopes.includes('wallet:send')) {
    expanded.add('wallet:read')
  }

  return Array.from(expanded)
}

export function formatScopeList (scopes) {
  return scopes.map(scope => {
    const info = OAUTH_SCOPES[scope]
    return info ? `${info.icon} ${info.name}` : scope
  }).join(', ')
}

export function getScopeHierarchy () {
  return {
    'wallet:read': {
      implied_by: ['wallet:send']
    }
  }
}
