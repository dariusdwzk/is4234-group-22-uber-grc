import { afterAll } from "vitest";
import { closeAll } from "./db";

afterAll(async () => {
  await closeAll();
});
