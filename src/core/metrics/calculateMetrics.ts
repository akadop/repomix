import type { RepomixConfigMerged } from '../../config/configSchema.js';
import type { RepomixProgressCallback } from '../../shared/types.js';
import type { ProcessedFile } from '../file/fileTypes.js';
import type { GitDiffResult } from '../git/gitDiffHandle.js';
import { calculateAllFileMetrics, calculateSelectiveFileMetrics } from './calculateAllFileMetrics.js';
import { calculateOutputMetrics } from './calculateOutputMetrics.js';

export interface CalculateMetricsResult {
  totalFiles: number;
  totalCharacters: number;
  totalTokens: number;
  fileCharCounts: Record<string, number>;
  fileTokenCounts: Record<string, number>;
  gitDiffTokenCount: number;
}

import { TokenCounter } from './TokenCounter.js';

export const calculateMetrics = async (
  processedFiles: ProcessedFile[],
  output: string,
  progressCallback: RepomixProgressCallback,
  config: RepomixConfigMerged,
  gitDiffResult: GitDiffResult | undefined,
  deps = {
    calculateAllFileMetrics,
    calculateSelectiveFileMetrics,
    calculateOutputMetrics,
  },
): Promise<CalculateMetricsResult> => {
  progressCallback('Calculating metrics...');

  // Calculate token count for git diffs if included
  let gitDiffTokenCount = 0;
  if (config.output.git?.includeDiffs && gitDiffResult) {
    const tokenCounter = new TokenCounter(config.tokenCount.encoding);

    const countPromises = [];
    if (gitDiffResult.workTreeDiffContent) {
      countPromises.push(Promise.resolve().then(() => tokenCounter.countTokens(gitDiffResult.workTreeDiffContent)));
    }
    if (gitDiffResult.stagedDiffContent) {
      countPromises.push(Promise.resolve().then(() => tokenCounter.countTokens(gitDiffResult.stagedDiffContent)));
    }

    gitDiffTokenCount = (await Promise.all(countPromises)).reduce((sum, count) => sum + count, 0);
    tokenCounter.free();
  }

  // For top files display optimization: calculate token counts only for top files by character count
  const topFilesLength = config.output.topFilesLength;
  const candidateFilesCount = Math.min(processedFiles.length, Math.max(topFilesLength * 10, topFilesLength));

  // Get top files by character count first
  const topFilesByChar = [...processedFiles]
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, candidateFilesCount);

  const topFilePaths = topFilesByChar.map((file) => file.path);

  const [selectiveFileMetrics, totalTokens] = await Promise.all([
    deps.calculateSelectiveFileMetrics(processedFiles, topFilePaths, config.tokenCount.encoding, progressCallback),
    deps.calculateOutputMetrics(output, config.tokenCount.encoding, config.output.filePath),
  ]);

  const totalFiles = processedFiles.length;
  const totalCharacters = output.length;

  // Build character counts for all files
  const fileCharCounts: Record<string, number> = {};
  for (const file of processedFiles) {
    fileCharCounts[file.path] = file.content.length;
  }

  // Build token counts only for top files
  const fileTokenCounts: Record<string, number> = {};
  for (const file of selectiveFileMetrics) {
    fileTokenCounts[file.path] = file.tokenCount;
  }

  return {
    totalFiles,
    totalCharacters,
    totalTokens,
    fileCharCounts,
    fileTokenCounts,
    gitDiffTokenCount: gitDiffTokenCount,
  };
};
