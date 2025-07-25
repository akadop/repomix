import type { RepomixConfigMerged } from '../../../config/configSchema.js';
import { logger, setLogLevelByWorkerData } from '../../../shared/logger.js';
import { processContent } from '../fileProcessContent.js';
import type { ProcessedFile, RawFile } from '../fileTypes.js';

// Initialize logger configuration from workerData at module load time
// This must be called before any logging operations in the worker
setLogLevelByWorkerData();

export interface FileProcessTask {
  rawFile: RawFile;
  config: RepomixConfigMerged;
}

export default async ({ rawFile, config }: FileProcessTask): Promise<ProcessedFile> => {
  const processedContent = await processContent(rawFile, config);
  return {
    path: rawFile.path,
    content: processedContent,
  };
};
