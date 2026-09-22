/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as adminRequests from "../adminRequests.js";
import type * as bookingRules from "../bookingRules.js";
import type * as bookings from "../bookings.js";
import type * as clientDeliveries from "../clientDeliveries.js";
import type * as clientNotifications from "../clientNotifications.js";
import type * as clientRequestRules from "../clientRequestRules.js";
import type * as clientRequests from "../clientRequests.js";
import type * as notificationKeys from "../notificationKeys.js";
import type * as notificationTemplates from "../notificationTemplates.js";
import type * as ownerAdministration from "../ownerAdministration.js";
import type * as reviewStudio from "../reviewStudio.js";
import type * as reviewStudioRules from "../reviewStudioRules.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  adminRequests: typeof adminRequests;
  bookingRules: typeof bookingRules;
  bookings: typeof bookings;
  clientDeliveries: typeof clientDeliveries;
  clientNotifications: typeof clientNotifications;
  clientRequestRules: typeof clientRequestRules;
  clientRequests: typeof clientRequests;
  notificationKeys: typeof notificationKeys;
  notificationTemplates: typeof notificationTemplates;
  ownerAdministration: typeof ownerAdministration;
  reviewStudio: typeof reviewStudio;
  reviewStudioRules: typeof reviewStudioRules;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
