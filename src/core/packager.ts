import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { SecretLintCoreResult } from '@secretlint/types';
import { RepopackConfigMerged } from '../config/configTypes.js';
import { sanitizeFiles as defaultSanitizeFiles } from './file/fileSanitizer.js';
import { generateOutput as defaultGenerateOutput } from './output/outputGenerator.js';
import { runSecurityCheck } from './security/securityCheckRunner.js';
import { searchFiles as defaultSearchFiles } from './file/fileSearcher.js';
import { TokenCounter } from './tokenCounter/tokenCounter.js';

export interface PackDependencies {
  searchFiles: typeof defaultSearchFiles;
  generateOutput: typeof defaultGenerateOutput;
  sanitizeFiles: typeof defaultSanitizeFiles;
}

export interface PackResult {
  totalFiles: number;
  totalCharacters: number;
  totalTokens: number;
  fileCharCounts: Record<string, number>;
  fileTokenCounts: Record<string, number>;
  suspiciousFilesResults: SecretLintCoreResult[];
}

export const pack = async (
  rootDir: string,
  config: RepopackConfigMerged,
  deps: PackDependencies = {
    searchFiles: defaultSearchFiles,
    generateOutput: defaultGenerateOutput,
    sanitizeFiles: defaultSanitizeFiles,
  },
): Promise<PackResult> => {
  // Get all file paths that should be processed
  const filePaths = await deps.searchFiles(rootDir, config);

  // Perform security check and filter out suspicious files
  const suspiciousFilesResults = await runSecurityCheck(filePaths, rootDir);
  const safeFilePaths = filePaths.filter(
    (filePath) => !suspiciousFilesResults.some((result) => result.filePath === path.join(rootDir, filePath)),
  );

  // Sanitize files and generate output
  const sanitizedFiles = await deps.sanitizeFiles(safeFilePaths, rootDir, config);
  const output = await deps.generateOutput(config, sanitizedFiles, safeFilePaths);

  // Write output to file
  const outputPath = path.resolve(rootDir, config.output.filePath);
  await fs.writeFile(outputPath, output);

  // Setup token counter
  const tokenCounter = new TokenCounter();

  // Metrics
  const totalFiles = sanitizedFiles.length;
  const totalCharacters = sanitizedFiles.reduce((sum, file) => sum + file.content.length, 0);
  const totalTokens = sanitizedFiles.reduce((sum, file) => sum + tokenCounter.countTokens(file.content), 0);
  const fileCharCounts: Record<string, number> = {};
  const fileTokenCounts: Record<string, number> = {};
  sanitizedFiles.forEach((file) => {
    fileCharCounts[file.path] = file.content.length;
    fileTokenCounts[file.path] = tokenCounter.countTokens(file.content);
  });
  tokenCounter.free();

  return {
    totalFiles,
    totalCharacters,
    totalTokens,
    fileCharCounts,
    fileTokenCounts,
    suspiciousFilesResults,
  };
};
