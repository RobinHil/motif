# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: open the [Security tab](https://github.com/RobinHil/motif/security) of the repository and choose **Report a vulnerability**. This creates a private advisory that only the maintainers can see.

Do not open a public issue for a security problem.

Include what you can: the affected version, your operating system, steps to reproduce, and the impact you expect. You will get an answer as soon as possible, and credit in the advisory if you want it.

## Supported versions

Only the latest release receives security fixes.

## Scope

Strudel code is JavaScript, and Motif runs it. A project that contains free code, received from someone else, is untrusted code. The renderer runs sandboxed, with no Node.js access and no network access, and a warning before opening such a project is planned. Reports about ways around these protections (sandbox escape, reaching the file system or the network from project code, path traversal through the `motif-sample://` protocol) are especially welcome.
