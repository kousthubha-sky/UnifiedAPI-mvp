'use client';

import React from 'react';

interface PaymentErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface PaymentErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

class PaymentErrorBoundary extends React.Component<PaymentErrorBoundaryProps, PaymentErrorBoundaryState> {
  constructor(props: PaymentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): PaymentErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Payment error caught by boundary:', error, errorInfo);

    // Log to monitoring service (e.g., Sentry, LogRocket)
    // You can integrate with your preferred error monitoring service here
    if (typeof window !== 'undefined' && (window as any).errorMonitoring) {
      (window as any).errorMonitoring.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          component: 'PaymentErrorBoundary',
        },
      });
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || PaymentErrorFallback;
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

interface PaymentErrorFallbackProps {
  error?: Error;
  resetError: () => void;
}

const PaymentErrorFallback: React.FC<PaymentErrorFallbackProps> = ({ error, resetError }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg
              className="h-8 w-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">Payment Error</h3>
            <p className="mt-1 text-sm text-gray-500">
              Something went wrong while processing your payment.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              {error.message || 'An unexpected error occurred'}
            </p>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={resetError}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Reload Page
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          If this problem persists, please contact support with the following information:
          <br />
          Error ID: {Date.now().toString(36)}
        </div>
      </div>
    </div>
  );
};

export { PaymentErrorBoundary, PaymentErrorFallback };
export default PaymentErrorBoundary;