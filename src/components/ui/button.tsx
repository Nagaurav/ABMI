import * as React from 'react';

// Button variant and size types
type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

// Type for variant styles with hover state
interface VariantStyle extends React.CSSProperties {
  hover?: React.CSSProperties;
}

// Base styles for the button
const baseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '0.375rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  transition: 'all 0.2s',
  cursor: 'pointer',
  outline: 'none',
};

// Focus styles
const focusStyles: React.CSSProperties = {
  boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.5)',
};

// Disabled styles
const disabledStyles: React.CSSProperties = {
  opacity: 0.5,
  pointerEvents: 'none',
};

// Variant styles
const variantStyles: Record<ButtonVariant, VariantStyle> = {
  default: {
    backgroundColor: '#3b82f6',
    color: 'white',
    hover: {
      backgroundColor: '#2563eb',
    },
  },
  destructive: {
    backgroundColor: '#ef4444',
    color: 'white',
    hover: {
      backgroundColor: '#dc2626',
    },
  },
  outline: {
    border: '1px solid #e5e7eb',
    backgroundColor: 'transparent',
    hover: {
      backgroundColor: '#f3f4f6',
    },
  },
  secondary: {
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
    hover: {
      backgroundColor: '#e5e7eb',
    },
  },
  ghost: {
    backgroundColor: 'transparent',
    hover: {
      backgroundColor: '#f3f4f6',
    },
  },
  link: {
    backgroundColor: 'transparent',
    color: '#3b82f6',
    textDecoration: 'none',
    hover: {
      textDecoration: 'underline',
    },
  },
};

// Size styles
const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  default: {
    height: '2.5rem',
    padding: '0.5rem 1rem',
  },
  sm: {
    height: '2.25rem',
    padding: '0 0.75rem',
    borderRadius: '0.375rem',
  },
  lg: {
    height: '2.75rem',
    padding: '0 2rem',
    borderRadius: '0.375rem',
  },
  icon: {
    width: '2.5rem',
    height: '2.5rem',
    padding: 0,
  },
};

// Merge styles function
const mergeStyles = (
  base: React.CSSProperties,
  variant: ButtonVariant,
  size: ButtonSize,
  style?: React.CSSProperties
): { base: React.CSSProperties; hover?: React.CSSProperties } => {
  const { hover, ...variantStyle } = variantStyles[variant] || {};
  
  const baseMerged = {
    ...base,
    ...variantStyle,
    ...sizeStyles[size],
    ...style,
  };

  return {
    base: baseMerged,
    hover: hover,
  };
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className = '',
    variant = 'default',
    size = 'default',
    asChild = false,
    style,
    ...props
  }, ref) => {
    const { base: buttonStyles, hover: hoverStyles } = mergeStyles(baseStyles, variant, size, style);
    
  // Handle hover state
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  
  const finalStyles = {
    ...buttonStyles,
    ...(isHovered && hoverStyles ? hoverStyles : {}),
    ...(isFocused ? focusStyles : {}),
    ...(props.disabled ? disabledStyles : {}),
  };

    return (
      <button
        ref={ref}
        style={finalStyles}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={className}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
