import { createServerFn } from "@tanstack/react-start";

import { readCheckoutAvailability } from "./payments-config.server";

/** Only public availability is returned; credentials and internal errors stay on the server. */
export const getCheckoutAvailability = createServerFn({ method: "GET" }).handler(() =>
  readCheckoutAvailability(),
);
