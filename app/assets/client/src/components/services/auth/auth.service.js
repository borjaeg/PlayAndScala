/*jshint esnext: true */
(function (angular) {
  var $inject = [
    '$rootScope',
    '$http',
    '$q',
    '$window',
    'cookieStore',
    'md5'
  ];

  const REFRESH_TOKEN_COOKIE_KEY = 'session_id';
  const AUTH_TOKEN_CACHE_KEY = 'session_auth_token';

  class AuthService {
    constructor($rootScope, $http, $q, $window, $cookies, md5) {
      this.$rootScope = $rootScope;
      this.$http = $http;
      this.$q = $q;
      this.$window = $window;
      this.$cookies = $cookies;
      this.md5 = md5;
    }

    isLoggedIn() {
      var refreshToken = this.$cookies.get(REFRESH_TOKEN_COOKIE_KEY);
      return (refreshToken || '').length > 0;
    }

    getServerToken() {
      return this.$q.when({
        token: 'harcoded_token',
        autoRereshToken: 'auto_refresh'
      });
    }

    getAuthToken() {
      var value = this.$window.sessionStorage.getItem(AUTH_TOKEN_CACHE_KEY);

      if(!value) {
        return this.$q.when(null);
      }

      var json = JSON.parse(value);
      var isExpired = json.expires < Date.now();

      return this.$q.when(isExpired ? null : json.token);
    }

    setAuthToken(token) {
      var json = {
        token: token,
        expires: Date.now() + (3600 * 1000)
      };
      this.$window.sessionStorage.setItem(AUTH_TOKEN_CACHE_KEY, JSON.stringify(json));
      this.$q.when();
    }

    refreshAuthToken() {
      if(!this.isLoggedIn()) {
        this.$q.reject(new Error('Not logged in'));
      }
      var newToken = 'refreshed_auth_token';
      this.setAuthToken(newToken);
    }

    refreshAuthTokenIfNotExpired() {
      var deferred = this.$q.defer();

      this.getAuthToken().then((authToken) => {
        if(!authToken) {
          return this.refreshAuthToken();
        }
        deferred.resolve();
      });

      return deferred.promise;
    }

    login(model) {
      var deferred = this.$q.defer();
      var failResponse = new AuthResponse(false, 'User or password does not exist');
      var payload = angular.copy(model);

      payload.password = this.md5.createHash(model.password || '');

      this.$http({
        method: 'POST',
        url: '/api/auth/login',
        data: payload
      }).success((data, status) => {
        if (status === 200) {
          this.getServerToken().then((tokenData) => {
            this.$cookies.put(REFRESH_TOKEN_COOKIE_KEY, tokenData.autoRereshToken, {
              path: '/',
              secure: false,
              expires: Date.now() + (30 * 24 * 3600 * 1000)
            });
            this.setAuthToken(tokenData.token);
          }).then(() => {
            this.$rootScope.isLoggedIn = true;
            this.$rootScope.$broadcast('auth:login');
            deferred.resolve(new AuthResponse(true));
          }).catch(function () {
            deferred.resolve(failResponse);
          });
        }
      }).error(() => {
        deferred.resolve(failResponse);
      }).catch(() => {
        deferred.resolve(failResponse);
      });

      return deferred.promise;
    }

    logout() {
      this.$window.sessionStorage.removeItem(AUTH_TOKEN_CACHE_KEY);
      this.$cookies.remove(REFRESH_TOKEN_COOKIE_KEY, {
        path: '/',
        secure: false
      });
      this.$rootScope.$broadcast('auth:logout');
      this.$rootScope.isLoggedIn = false;
      return this.$q.when();
    }

    createAccount(model) {
      var deferred = this.$q.defer();

      this.$http({
        method: 'POST',
        url: '/api/auth/create',
        data: model
      }).success((data, status) => {
        if (status === 201) {
          deferred.resolve(new AuthResponse(true));
        }
        deferred.resolve(new AuthResponse(false, 'User already exists'));
      }).error(() => {
        deferred.resolve(new AuthResponse(false, 'Unexpected error from the server'));
      }).catch(() => {
        deferred.resolve(new AuthResponse(false, 'Unexpected error from the server'));
      });

      return deferred.promise;
    }

    resetPassword(model) {
      var deferred = this.$q.defer();

      this.$http({
        method: 'POST',
        url: '/api/auth/resetpassword',
        data: model
      }).success((data, status) => {
        if (status === 200) {
          deferred.resolve(new AuthResponse(true));
        }
        deferred.resolve(new AuthResponse(false, 'User already exists'));
      }).error(() => {
        deferred.resolve(new AuthResponse(false, 'Unexpected error from the server'));
      }).catch(() => {
        deferred.resolve(new AuthResponse(false, 'Unexpected error from the server'));
      });

      return deferred.promise;
    }
  }

  class AuthResponse {
    constructor(success, errorMessage) {
      this.success = success;
      this.message = errorMessage;
    }
  }

  AuthService.$inject = $inject;
  angular.module('app')
    .service('AuthService', AuthService);

})(angular);
