import type React from 'react';
import { useRef, useState, useEffect } from 'react';
import SignaturePad from 'react-signature-canvas';
import {
  Stack,
  PrimaryButton,
  DefaultButton,
  Text,
  mergeStyleSets,
  useTheme
} from '@fluentui/react';

interface SignatureCanvasProps {
  onSave: (signatureDataUrl: string) => void;
  width?: number;
  height?: number;
  label?: string;
  required?: boolean;
  errorMessage?: string;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  onSave,
  width = 500,
  height = 200,
  label = 'Signature',
  required = false,
  errorMessage
}) => {
  const signaturePadRef = useRef<SignaturePad>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [showError, setShowError] = useState(!!errorMessage);
  const theme = useTheme();

  // Reset error state when errorMessage changes
  useEffect(() => {
    setShowError(!!errorMessage);
  }, [errorMessage]);

  const clear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setIsEmpty(true);
      setShowError(false);
    }
  };

  const handleSave = () => {
    if (signaturePadRef.current) {
      if (required && signaturePadRef.current.isEmpty()) {
        setShowError(true);
        return;
      }

      // Try to get trimmed canvas, fallback to regular canvas if trim fails
      let dataUrl;
      try {
        dataUrl = signaturePadRef.current.getTrimmedCanvas().toDataURL('image/png');
      } catch (error) {
        console.warn('getTrimmedCanvas failed, using regular canvas:', error);
        dataUrl = signaturePadRef.current.getCanvas().toDataURL('image/png');
      }
      onSave(dataUrl);
      setShowError(false);
    }
  };

  const handleBegin = () => {
    setIsEmpty(false);
    setShowError(false);
  };

  const styles = mergeStyleSets({
    canvasContainer: {
      border: `1px solid ${theme.palette.neutralLight}`,
      backgroundColor: '#fff',
      borderRadius: '4px',
      boxShadow: theme.effects.elevation4,
      touchAction: 'none', // Prevents scrolling on touch devices
    },
    errorMessage: {
      color: theme.semanticColors.errorText,
      fontSize: '12px',
      marginTop: '4px'
    },
    canvasLabel: {
      marginBottom: '5px',
      display: 'flex',
      alignItems: 'center'
    },
    requiredIndicator: {
      color: theme.semanticColors.errorText,
      marginLeft: '4px',
    }
  });

  // Responsive canvas width
  const canvasWidth = Math.min(width, window.innerWidth - 40);

  return (
    <Stack tokens={{ childrenGap: 12 }}>
      {label && (
        <div className={styles.canvasLabel}>
          <Text variant="mediumPlus">{label}</Text>
          {required && <span className={styles.requiredIndicator}>*</span>}
        </div>
      )}

      <div className={styles.canvasContainer} style={{ width: canvasWidth, height }}>
        <SignaturePad
          ref={signaturePadRef}
          canvasProps={{
            width: canvasWidth,
            height,
            className: 'signature-canvas'
          }}
          onBegin={handleBegin}
        />
      </div>

      {showError && errorMessage && (
        <Text className={styles.errorMessage}>{errorMessage}</Text>
      )}

      <Stack horizontal tokens={{ childrenGap: 8 }}>
        <PrimaryButton text="Save Signature" onClick={handleSave} disabled={isEmpty && required} />
        <DefaultButton text="Clear" onClick={clear} disabled={isEmpty} />
      </Stack>
    </Stack>
  );
};

export default SignatureCanvas;
