import { z } from 'zod';

// Avoid Zod's dynamic Function probe/JIT so CSP can keep eval disabled.
z.config({ jitless: true });
