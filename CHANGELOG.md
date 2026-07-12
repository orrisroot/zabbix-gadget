# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-07-13

### Added
- **Trigger Deduplication**: Automatically skip redundant lower-severity triggers when a higher-severity dependent trigger is active, utilizing Zabbix's built-in dependency resolution (`skipDependent: true`).

## [0.1.0] - 2026-07-10

- Initial release of Zabbix Desktop Gadget.
