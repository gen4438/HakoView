import React from 'react';

interface ErrorDisplayProps {
  message: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message }) => {
  return (
    <div className="error">
      <div className="error-title">⚠️ Error</div>
      <div className="error-message">{message}</div>
    </div>
  );
};
