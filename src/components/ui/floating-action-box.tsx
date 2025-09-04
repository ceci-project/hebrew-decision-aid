import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Upload } from 'lucide-react';

interface FloatingActionBoxProps {
  onAnalyze: () => void;
  onFileUpload: () => void;
  busy?: boolean;
  disabled?: boolean;
}

export const FloatingActionBox: React.FC<FloatingActionBoxProps> = ({
  onAnalyze,
  onFileUpload,
  busy = false,
  disabled = false
}) => {
  return (
    <div className="fixed bottom-6 left-6 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 space-y-2 min-w-[160px]">
      {/* Quick Actions Header */}
      <div className="text-xs font-medium text-gray-600 text-center border-b border-gray-100 pb-2 mb-2">
        פעולות מהירות
      </div>
      
      {/* Analyze Button */}
      <Button
        onClick={onAnalyze}
        disabled={disabled || busy}
        className="w-full text-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
        size="sm"
      >
        <FileText className="w-4 h-4" />
        {busy ? 'מנתח...' : 'נתח מסמך'}
      </Button>
      
      {/* Upload Button */}
      <Button
        onClick={onFileUpload}
        disabled={busy}
        variant="outline"
        className="w-full text-sm border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-2"
        size="sm"
      >
        <Upload className="w-4 h-4" />
        העלה קובץ
      </Button>
      
      {/* Status Indicator */}
      {busy && (
        <div className="flex items-center justify-center gap-2 text-xs text-blue-600 pt-1">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
          עובד...
        </div>
      )}
    </div>
  );
};

export default FloatingActionBox;