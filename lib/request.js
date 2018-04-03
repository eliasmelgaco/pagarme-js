/**
 * @name Request
 * @description This module handles the HTTP requests to Pagar.me's API.  '
 *              It exports GET, PUT, POST, DELETE functions based upon
 *              the `fetch` module.
 *
 * @module request
 * @private
 */

import Promise from 'bluebird'
import {
  curry,
  merge,
  length,
  keys,
} from 'ramda'
import qs from 'qs'
import routes from './routes'
import ApiError from './errors'

require('isomorphic-fetch')

const defaultHeaders = {
  'Content-Type': 'application/json',
}

/**
 * This method builds the final method, body and headers
 * that will be used in `fetch`.
 *
 * @param {String} method
 * @param {String} endpoint
 * @param {Object} options
 * @param {Object} data
 * @returns {Object} An object containing a URL property
 *                   and an object in the form of
 *                   `{ method, body, headers }`
 * @private
 */
function buildRequestParams (method, endpoint, options, data) {
  let query = ''
  let body = ''
  let params = null
  let headers = options.headers || {}

  const payload = merge(
    options.body || {},
    data || {}
  )

  const queries = options.qs || {}

  if (length(keys(queries))) {
    query = `${qs.stringify(queries)}`
  }

  const shouldStringifyPayload = ['GET', 'HEAD', 'PUT'].includes(method)

  const requestHasBody = !['GET', 'HEAD'].includes(method)

  if (shouldStringifyPayload) {
    query += `${query ? '&' : ''}${qs.stringify(payload, { encode: false })}`
    params = {
      method,
    }
  }

  if (requestHasBody) {
    body = JSON.stringify(payload)
    headers = merge(headers, defaultHeaders)
    params = {
      method,
      body,
      headers,
    }
  }

  const url = `${endpoint}${query ? `?${query}` : ''}`

  return {
    url,
    params,
  }
}

const emitError = curry((options, error) => {
  const result = options.onError
    ? options.onError(error)
    : true

  console.log('xxxxxx', { result, options, onError: options.onError })

  if (result) {
    return Promise.reject(error)
  }

  return Promise.resolve()
})

/**
 * This function handles the request erros,
 * returning a Promise that will reject to
 * a custom ApiError with a relevant message.
 *
 * @param {Object} response
 * @returns {Promise} A Promise rejection with a
 *                    Server Error message or the
 *                    error response body
 * @private
 */
function handleError (options, response) {
  if (response.status === 500) {
    const error = new ApiError({
      status: 500,
      errors: [{ message: 'Pagar.me server error' }],
    })

    return emitError(options, error)
  }

  return response.json()
    .then(merge({ status: response.status }))
    .then(error => emitError(options, new ApiError(error)))
}

/**
 * This simple function handles the result of a
 * request, returning either a JSON response
 * or forwarding the error handling to another
 * function.
 *
 * @param {Object} response
 * @returns {Promise} A promise that will either
 *                    resolve to the Response JSON
 *                    conversion or further the chain to
 *                    [handleError]{@link handleError}
 * @private
 */
const handleResult = curry((options, response) => {
  if (response.ok) {
    return response.json()
  }

  return handleError(options, response)
})

/**
 * This function returns a new function,
 * created from the supplied `method`.
 * The returned function uses
 * [buildRequestParams]{@link buildRequestParams}
 * to define the request's URL, headers and body.
 *
 * @param {String} method
 * @returns {Function} A `request` function that
 *                     will return a Promise with
 *                     the server response
 * @private
 */
function buildRequest (method) {
  return function request (options = {}, path, body = {}) {
    const endpoint = (options.baseURL || routes.base) + path
    const { url, params } = buildRequestParams(method, endpoint, options, body)
    return fetch(url, params).then(handleResult(options))
  }
}

export default {
  get: buildRequest('GET'),
  put: buildRequest('PUT'),
  post: buildRequest('POST'),
  delete: buildRequest('DELETE'),
}