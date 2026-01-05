import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { logger } from './logger';

/**
 * Downloads a file from a secure URL using authentication headers and shares/opens it.
 * 
 * @param url - The absolute URL of the file to download
 * @param fileName - The name to save the file as (e.g., 'invoice-123.pdf')
 * @param token - The Bearer token for authentication
 * @param mimeType - Optional mime type for sharing (default: 'application/pdf')
 */
export const downloadAndShareAuthenticated = async (
  url: string,
  fileName: string,
  token: string | null,
  mimeType: string = 'application/pdf'
): Promise<void> => {
  try {
    if (!token) {
      throw new Error('Authentication token is missing');
    }

    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    
    logger.info(`Downloading file from ${url} to ${fileUri}`);

    // Download with headers
    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      fileUri,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (!result || result.status !== 200) {
      logger.error('Download failed', result);
      throw new Error(`Download failed with status ${result?.status}`);
    }

    logger.info('Download complete, attempting to share');

    // Check if sharing is available
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Error', 'Sharing is not available on this device');
      return;
    }

    // Share/Open the file
    await Sharing.shareAsync(fileUri, {
      mimeType: mimeType,
      dialogTitle: 'View Statement',
      UTI: 'com.adobe.pdf', // for iOS
    });

  } catch (error: any) {
    logger.error('Error downloading document', error);
    Alert.alert(
      'Download Failed',
      'Could not download the document. Please try again. ' + (error.message || '')
    );
  }
};
