define([
    "ol",
    "gp",
    "woodman",
    "Ol3/Utils",
    "Ol3/Controls/Utils/Markers",
    "Common/Utils/CheckRightManagement",
    "Common/Utils/SelectorID",
    "Common/Controls/SearchEngineDOM",
    "Common/Controls/SearchEngineUtils"
], function (
    ol,
    Gp,
    woodman,
    Utils,
    Markers,
    RightManagement,
    SelectorID,
    SearchEngineDOM,
    SearchEngineUtils
) {
    "use strict";

    woodman.load("console");
    var logger = woodman.getLogger("searchengine");

    /**
     * @classdesc
     * SearchEngine control
     *
     * @constructor
     * @extends {ol.control.Control}
     * @alias ol.control.SearchEngine
     * @param {Object}  options - control options
     * @param {String}   [options.apiKey] - API key, mandatory if autoconf service has not been charged in advance
     * @param {Boolean} [options.collapsed = true] - collapse mode, true by default
     * @param {Object}   [options.resources] - resources to be used by geocode and autocompletion services :
     * @param {Array}   [options.resources.geocode] - resources geocoding, by default : ["PositionOfInterest", "StreetAddress"]
     * @param {Array}   [options.resources.autocomplete] - resources autocompletion, by default : ["PositionOfInterest", "StreetAddress"]
     * @param {Boolean}  [options.displayAdvancedSearch = true] - False to disable advanced search tools (it will not be displayed). Default is true (displayed)
     * @param {Object}  [options.advancedSearch] - advanced search options for geocoding (filters). Properties can be found among geocode options.filterOptions (see {@link http://ignf.github.io/geoportal-access-lib/latest/jsdoc/module-Services.html#~geocode Gp.Services.geocode})
     * @param {Object}  [options.geocodeOptions = {}] - options of geocode service (see {@link http://ignf.github.io/geoportal-access-lib/latest/jsdoc/module-Services.html#~geocode Gp.Services.geocode})
     * @param {Object}  [options.autocompleteOptions = {}] - options of autocomplete service (see {@link http://ignf.github.io/geoportal-access-lib/latest/jsdoc/module-Services.html#~autoComplete Gp.Services.autoComplete}
     * @param {Sting|Numeric|Function} [options.zoomTo] - zoom to results, by default, current zoom.
     *       Value possible : auto or zoom level.
     *       Possible to overload it with a function :
     *       zoomTo : function (info) {
     *           // do some stuff...
     *           return zoom;
     *       }
     * @example
     *  var SearchEngine = ol.control.SearchEngine({
     *      apiKey : "CLEAPI",
     *      collapsed : true,
     *      resources : {
     *          geocode : ["StreetAddress", "PositionOfInterest"],
     *          autocomplete : ["StreetAddress"]
     *      },
     *      advancedSearch : {
     *          PositionOfInterest : [{name : "municipality", title : "Ville"}],
     *          StreetAddress : [{...}]
     *      },
     *      geocodeOptions : {},
     *      autocompleteOptions : {}
     *  });
     */
    function SearchEngine (options) {

        options = options || {};

        if (!(this instanceof SearchEngine)) {
            throw new TypeError("ERROR CLASS_CONSTRUCTOR");
        }

        // initialisation du composant
        this.initialize(options);

        // // Widget main DOM container
        this._container = this._initContainer();
        // info: le container sera complété lors de l'ajout à la carte (setMap), car certains composants nécessitent d'être liés à la map.
        this._containerElement = null;

        // on peut éventuellement encapsuler le composant dans une div passée par l'utilisateur
        if ( options.element && options.element.appendChild ) {
            // dans ce cas on stocke les deux container
            options.element.appendChild(this._container);
            this._containerElement = options.element;
        }

        // call ol.control.Control constructor
        ol.control.Control.call(this,
            {
                element : this._containerElement || this._container,
                target : options.target,
                render : options.render
            }
        );

    };

    // Inherits from ol.control.Control
    ol.inherits(SearchEngine, ol.control.Control);

    /*
     * @lends module:SearchEngine
     */
    SearchEngine.prototype = Object.create(ol.control.Control.prototype, {});

    // on récupère les méthodes de la classe commune IsoDOM
    Utils.assign(SearchEngine.prototype, SearchEngineDOM);

    /**
     * Constructor (alias)
     *
     * @private
     */
    SearchEngine.prototype.constructor = SearchEngine;

    // ################################################################### //
    // ##################### public methods ############################## //
    // ################################################################### //

    /**
     * Overwrite OpenLayers setMap method
     *
     * @param {ol.Map} map - Map.
     */
    SearchEngine.prototype.setMap = function (map) {

        if ( ! map ) {
            this._clearResults();
        }

        // on appelle la méthode setMap originale d'OpenLayers
        ol.control.Control.prototype.setMap.call(this, map);

    };

    /**
     * Returns true if widget is collapsed (minimized), false otherwise
     *
     * @returns {Boolean} collapsed - true if widget is collapsed
     */
    SearchEngine.prototype.getCollapsed = function () {
        return this.collapsed;
    };

    /**
     * Collapse or display widget main container
     *
     * @param {Boolean} collapsed - True to collapse widget, False to display it
     */
    SearchEngine.prototype.setCollapsed = function (collapsed) {
        if ( collapsed === undefined ) {
            console.log("[ERROR] SearchEngine:setCollapsed - missing collapsed parameter");
            return;
        }
        if ( ( collapsed && this.collapsed) || ( !collapsed && !this.collapsed ) ) {
            return;
        }
        if ( collapsed ) {
            this._showSearchEngineInput.click();
        } else {
            this._showSearchEngineInput.click();
        }
        this.collapsed = collapsed;
    };

    // ################################################################### //
    // ##################### init component ############################## //
    // ################################################################### //

    /**
     * Initialize SearchEngine control (called by SearchEngine constructor)
     *
     * @param {Object} options - constructor options
     * @private
     */
    SearchEngine.prototype.initialize = function (options) {

        this._checkInputOptions(options);

        // define default options
        this.options = {
            collapsed : true,
            zoomTo : "",
            resources : {
                geocode : [],
                autocomplete : []
            },
            displayAdvancedSearch : true,
            advancedSearch : {},
            geocodeOptions : {},
            autocompleteOptions : {}
        };

        // merge with user options
        Utils.mergeParams(this.options, options);
        if ( this.options.resources.geocode.length === 0 ) {
            this.options.resources.geocode = ["PositionOfInterest", "StreetAddress"];
        }
        if ( this.options.resources.autocomplete.length === 0 ) {
            this.options.resources.autocomplete = ["PositionOfInterest", "StreetAddress"];
        }

        /** {Boolean} specify if searchEngine control is collapsed (true) or not (false) */
        this.collapsed = this.options.collapsed;

        // identifiant du contrôle : utile pour suffixer les identifiants CSS (pour gérer le cas où il y en a plusieurs dans la même page)
        this._uid = SelectorID.generate();

        this._showSearchEngineInput = null;

        // container de l'input de recherche
        this._inputSearchContainer = null;

        // container des reponses de l'autocompletion
        this._autocompleteContainer = null;
        this._suggestedContainer = null;

        // listes des reponses de l'autocompletion
        this._suggestedLocations = [];

        // container des reponses du geocodage
        this._geocodedContainer = null;

        // liste des reponses du geocodage
        this._geocodedLocations = [];

        // container des filtres du geocodage
        this._filterContainer = null;

        // ressource de geocodage selectionnée pour le geocodage avancé
        this._currentGeocodingCode = null;

        // localisant */
        this._currentGeocodingLocation = null;

        // liste des filtres du geocodage pour le geocodage avancé
        this._advancedSearchFilters = {};
        this._initAdvancedSearchFilters();

        // liste des ressources du geocodage pour le geocodage avancé
        this._advancedSearchCodes = [];
        this._initAdvancedSearchCodes();

        // marker
        this._marker = null;
        this._markerUrl = Markers["lightOrange"];

        // popup
        this._popupContent = null;
        this._popupDiv = this._initPopupDiv();
        this._popupOverlay = null;

        // ressources des services d'autocompletion et de geocodage
        this._servicesRightManagement = {};

        /*
         * Droit sur les ressources sur les services.
         * Par defaut, on n'en s'occupe pas
         * sauf si l'autoconfiguration est chargée !
         */
        this._noRightManagement = false;

        // gestion des droits sur les ressources/services
        this._checkRightsManagement();

    };

    /**
     * this method is called by this.initialize()
     * and makes sure input options are correctly formated
     *
     * @private
     */
    SearchEngine.prototype._checkInputOptions = function (options) {
        var i;

        if ( options.resources ) {
            // on vérifie que resources est bien un objet
            if ( typeof options.resources === "object" ) {

                // ressources de geocodage
                var geocodeResources = options.resources.geocode;
                if ( geocodeResources ) {
                    // on vérifie que la liste des ressources de geocodage est bien un tableau
                    if ( !Array.isArray(geocodeResources) ) {
                        console.log("[SearchEngine] 'options.resources.geocode' parameter should be an array");
                        geocodeResources = null;
                    }
                    var geocodeResourcesList = ["StreetAddress", "PositionOfInterest", "CadastralParcel", "Administratif"];
                    for ( i = 0; i < geocodeResources.length; i++ ) {
                        if ( geocodeResourcesList.indexOf(geocodeResources[i]) === -1 ) {
                            // si la resource n'est pas référencée, on l'enlève
                            // geocodeResources.splice(i, 1);
                            console.log("[SearchEngine] options.resources.geocode : " + geocodeResources[i] + " is not a resource for geocode");
                        }
                    }
                }

                // ressources d'autocompletion
                var autocompleteResources = options.resources.autocomplete;
                if ( autocompleteResources ) {
                    // on vérifie que la liste des ressources d'autocompletion est bien un tableau
                    if ( !Array.isArray(autocompleteResources) ) {
                        console.log("[SearchEngine] 'options.resources.autocomplete' parameter should be an array");
                        autocompleteResources = null;
                    }
                    var autocompleteResourcesList = ["StreetAddress", "PositionOfInterest"];
                    for ( i = 0; i < autocompleteResources.length; i++ ) {
                        if ( autocompleteResourcesList.indexOf(autocompleteResources[i]) === -1 ) {
                            // si la resource n'est pas référencée, on l'enlève
                            // autocompleteResources.splice(i, 1);
                            console.log("[SearchEngine] options.resources.autocomplete : " + autocompleteResources[i] + " is not a resource for autocomplete");
                        }
                    }
                }
            } else {
                console.log("[SearchEngine] 'resources' parameter should be an object");
                options.resources = null;
            }
        }

    };

    /**
     * this method is called by this.initialize()
     * and initialize the geocoding resources titles.
     *
     * @private
     */
    SearchEngine.prototype._initAdvancedSearchCodes = function () {

        // INFORMATION
        // on y ajoute les filtres attributaires pour une table de ressources
        // selectionnée via un evenement (onchange) de la liste deroulante du
        // menu avancé du geocodage.
        // cf. onGeocodingAdvancedSearchCodeChange() pour la selection de la
        // ressource de geocodage à afficher

        var geocodeResources = this.options.resources.geocode;
        for ( var i = 0; i < geocodeResources.length; i++ ) {
            switch ( geocodeResources[i] ) {
                case "PositionOfInterest" :
                    this._advancedSearchCodes.push({
                        id : "PositionOfInterest",
                        title : "Lieux/toponymes"
                    });
                    break;
                case "StreetAddress" :
                    this._advancedSearchCodes.push({
                        id : "StreetAddress",
                        title : "Adresses"
                    });
                    break;
                case "CadastralParcel" :
                    this._advancedSearchCodes.push({
                        id : "CadastralParcel",
                        title : "Parcelles cadastrales"
                    });
                    break;
                case "Administratif" :
                    this._advancedSearchCodes.push({
                        id : "Administratif",
                        title : "Administratif"
                    });
                    break;
                default :
                    break;
            }
        }
        // par défaut, au cas où aucune ressource passée en option ne correspond à celles attendues
        if ( this._advancedSearchCodes.length === 0 ) {
            this._advancedSearchCodes = [
                {
                    id : "StreetAddress",
                    title : "Adresses"
                },
                {
                    id : "PositionOfInterest",
                    title : "Lieux/toponymes"
                }
            ];
        }

        logger.log("advancedSearchCodes", this._advancedSearchCodes);
    };

    /**
     * this method is called by this.onAdd()
     * and initialize the advanced geocoding filters.
     *
     * @private
     */
    SearchEngine.prototype._initAdvancedSearchFilters = function () {

        // liste des filtres par defauts pour toutes les ressources
        this._advancedSearchFilters = SearchEngineUtils.advancedSearchFiltersByDefault;

        // on merge les options avancées avec celles par defaut
        var advancedSearchFiltersCustom = this.options.advancedSearch;
        Utils.assign(this._advancedSearchFilters, advancedSearchFiltersCustom);

        logger.log("advancedSearchFilters", this._advancedSearchFilters);
    };

    /**
     * this method is called by this.initialize() and initialize popup div
     * (to display results information on marker click)
     *
     * @return {Object} element - DOM element for popup
     * @private
     */
    SearchEngine.prototype._initPopupDiv = function () {
        var context = this;
        var element = document.createElement("div");
        element.className = "gp-feature-info-div";
        var closer = document.createElement("input");
        closer.type = "button";
        closer.className = "gp-styling-button closer";
        /** on closer click : remove popup */
        closer.onclick = function () {
            if ( context._popupOverlay != null ) {
                context._popupOverlay.setPosition(undefined);
            }
            return false;
        };
        this._popupContent = document.createElement("div");
        this._popupContent.className = "gp-features-content-div";
        this._popupContent.style["min-width"] = "200px";
        element.appendChild(this._popupContent);
        element.appendChild(closer);

        return element;
    };

    // ################################################################### //
    // ######################## DOM initialize ########################### //
    // ################################################################### //

    /**
     * Create control main container
     *
     * @private
     */
    SearchEngine.prototype._initContainer = function () {
        // create main container
        var container = this._createMainContainerElement();

        // create show search engine element
        var inputShow = this._showSearchEngineInput = this._createShowSearchEngineElement();
        container.appendChild(inputShow);

        // mode "collapsed"
        if ( !this.options.collapsed ) {
            inputShow.checked = true;
        }

        // create search engine picto
        var picto = this._createShowSearchEnginePictoElement();
        container.appendChild(picto);

        var search = this._inputSearchContainer = this._createSearchInputElement();
        var context = this;
        if ( search.addEventListener ) {
            search.addEventListener("click", function () {
                context.onAutoCompleteInputClick();
            });
        } else if (search.attachEvent) {
            search.attachEvent("onclick", function () {
                context.onAutoCompleteInputClick();
            });
        }
        container.appendChild(search);

        if ( this.options.displayAdvancedSearch ) {
            var advancedShow = this._createShowAdvancedSearchElement();
            container.appendChild(advancedShow);

            // INFO je decompose les appels car j'ai besoin de recuperer le container
            // des filtres
            var advancedPanel   = this._createAdvancedSearchPanelElement();
            var advancedHeader  = this._createAdvancedSearchPanelHeaderElement();
            var advancedForm    = this._createAdvancedSearchPanelFormElement(this._advancedSearchCodes);
            var advancedFormFilters  = this._filterContainer = this._createAdvancedSearchFormFiltersElement();
            this._setFilter(this._advancedSearchCodes[0].id); // ex "PositionOfInterest"
            var advancedFormInput    = this._createAdvancedSearchFormInputElement();
            advancedForm.appendChild(advancedFormFilters);
            advancedForm.appendChild(advancedFormInput);
            advancedPanel.appendChild(advancedHeader);
            advancedPanel.appendChild(advancedForm);
            container.appendChild(advancedPanel);
        }

        // INFO je decompose les appels car j'ai besoin de recuperer le container
        // des resultats de l'autocompletion
        var autocomplete     = this._autocompleteContainer = this._createAutoCompleteElement();
        var autocompleteList = this._suggestedContainer = this._createAutoCompleteListElement();
        autocomplete.appendChild(autocompleteList);
        container.appendChild(autocomplete);

        // INFO je decompose les appels car j'ai besoin de recuperer le container
        // des resultats du geocodage
        var geocode       = this._createGeocodeResultsElement();
        var geocodeList   = this._geocodedContainer = this._createGeocodeResultsListElement();
        geocode.appendChild(geocodeList);
        container.appendChild(geocode);

        return container;
    };

    /**
     * this method is called by :
     * - this._initContainer() : ...
     * - this.onGeocodingAdvancedSearchCodeChoice() : ...
     * and initialize or create the filters container HTMLElement
     * to the geocoding advanced menu.
     *
     * @param {String} code - resource geocoding name
     * @private
     */
    SearchEngine.prototype._setFilter = function (code) {

        // INFORMATION
        // Nous avons 2 solutions possibles pour la mise en place des filtres.
        // 1. Soit on decide de creer tous les filtres pour chaque ressource
        // de geocodage à l'initialisation du composant, et on joue sur le
        // mode 'hidden' pour n'afficher que la ressource selectionnée.
        // 2. Soit on decide de creer à chaque fois les filtres pour la
        // ressource selectionnée.
        // Chaque solution a ses inconvenients/avantages.
        // Implementation du choix 2 car elle offre plus de souplesse pour
        // recuperer les 'form-data'...

        var container = this._filterContainer;

        var codeFound = false;
        for (var i = 0; i < this._advancedSearchCodes.length; i++) {
            if (this._advancedSearchCodes[i].id === code) {
                codeFound = true;
                break;
            }
        }

        if (! codeFound) {
            // cette ressource n'est pas disponible,
            // on supprime les anciens enfants...
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            return;
        }

        // on sauvegarde la ressource de geocodage sélectionnée
        this._currentGeocodingCode = code;

        // on supprime les enfants...
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        var lstAttributs = this._advancedSearchFilters[code];
        if (!lstAttributs || lstAttributs.length === 0) {
            // cette ressource n'est pas parametrable
            return;
        }

        var divTable = this._createAdvancedSearchFiltersTableElement(code, true);

        for (var j = 0; j < lstAttributs.length; j++) {
            var divFilter = this._createAdvancedSearchFiltersAttributElement(lstAttributs[j]);
            divTable.appendChild(divFilter);
        }

        container.appendChild(divTable);

        return container;
    };

    // ################################################################### //
    // ##################### methods rights management ################### //
    // ################################################################### //

    /**
     * this method is called by constructor
     * and check the rights to resources and services
     *
     * @private
     */
    SearchEngine.prototype._checkRightsManagement = function () {

        // INFORMATION
        // l'autoconfiguration n'est utile que pour récupérer la clef si elle
        // n'est pas renseignée, et pour vérifier les droits sur les ressources
        // et les services.

        // si l'autoconfiguration n'est pas chargée,
        // il est toujours possible de requeter le service avec une clef API,
        // mais les droits sur les ressources ne sont pas garantis, on risque
        // d'obtenir des erreurs 403 forbidden..., la responsabilité revient
        // à l'utilisateur (message d'information)...
        // par contre, sans clef API renseignée au niveau du controle,
        // l'utilisateur doit la renseigner au niveau des services...,
        // sinon, Exception du service

        // si l'autoconfiguration est chargée,
        // si une clef API est renseignée au niveau controle, on controle
        // le mapping entre le contrat et la clef...
        // on obtient la liste des ressources ayant droits,
        // si on ne trouve pas de ressources ou certaines ressources ne sont
        // pas disponible, on previent l'utilisateur (message d'information).

        var _resources = [];
        var _key;
        var _opts = null;

        // les ressources du service d'autocompletion
        _key  = this.options.autocompleteOptions.apiKey;
        _opts = this.options.autocompleteOptions.filterOptions;
        // on récupère les éventuelles ressources passées en option, soit dans autocompleteOptions
        _resources = (_opts) ? _opts.type : [];
        // soit dans options.resources.autocomplete
        if ( !_resources || _resources.length === 0 ) {
            _resources = this.options.resources.autocomplete;
        }
        // ou celles par défaut sinon.
        if ( !_resources || _resources.length === 0 ) {
            _resources = [
                "StreetAddress",
                "PositionOfInterest"
            ];
        }
        var rightManagementAutoComplete = RightManagement.check({
            key :  _key || this.options.apiKey,
            resources : _resources,
            services : ["AutoCompletion"]
        });
        logger.log("rightManagementAutoComplete", rightManagementAutoComplete);

        // les ressources du service de geocodage
        _key  = this.options.geocodeOptions.apiKey;
        _opts = this.options.geocodeOptions.filterOptions;
        // on récupère les éventuelles ressources passées en option, soit dans geocodeOptions :
        _resources = (_opts) ? _opts.type : [];
        // soit directement dans options.resources.geocode :
        if ( !_resources || _resources.length === 0 ) {
            _resources = this.options.resources.geocode;
        }
        // ou celles par défaut sinon.
        if ( !_resources || _resources.length === 0 ) {
            _resources = [
                "StreetAddress",
                "PositionOfInterest"
            ];
        }
        var rightManagementGeocode = RightManagement.check({
            key :  _key || this.options.apiKey,
            resources : _resources,
            services : ["Geocode"]
        });
        logger.log("rightManagementGeocode", rightManagementGeocode);

        // aucun droit !
        if ( !rightManagementAutoComplete && !rightManagementGeocode ) {
            this._noRightManagement = true;
            return;
        }

        // on recupère les informations utiles
        // Ex. la clef API issue de l'autoconfiguration si elle n'a pas
        // été renseignée.
        if ( !this.options.apiKey ) {
            if ( rightManagementGeocode ) {
                this.options.apiKey = rightManagementGeocode.key;
            } else {
                this.options.apiKey = rightManagementAutoComplete.key;
            }
        }

        // les ressources par services ayant droit doivent servir pour les
        // appels aux services
        if (rightManagementAutoComplete) {
            this._servicesRightManagement["AutoCompletion"] = rightManagementAutoComplete["AutoCompletion"];
        }

        if (rightManagementGeocode) {
            this._servicesRightManagement["Geocode"] = rightManagementGeocode["Geocode"];
        }

    };

    // ################################################################### //
    // ################ methods to request and results ################### //
    // ################################################################### //

    /**
     * this method is called by this.onAutoCompleteSearch()
     * and executes a request to the service.
     *
     * @param {Object} settings - service settings
     * @param {String}   settings.text - text
     * @param {Function} settings.onSuccess - callback
     * @param {Function} settings.onFailure - callback
     * @private
     */
    SearchEngine.prototype._requestAutoComplete = function (settings) {

        // on ne fait pas de requête si on n'a pas renseigné de parametres !
        if (!settings || ( typeof settings === "object" && Object.keys(settings).length === 0 ) ) {
            return;
        }

        // on ne fait pas de requête si la parametre 'text' est vide !
        if (!settings.text) {
            return;
        }

        logger.log(settings);

        var options = {};
        // on recupere les options du service
        Utils.assign(options, this.options.autocompleteOptions);
        // ainsi que la recherche et les callbacks
        Utils.assign(options, settings);

        // on ajoute le paramètre filterOptions.type spécifiant les ressources.
        var resources = this.options.resources.autocomplete;
        if (resources && Array.isArray(resources) ) {
            if (! options.filterOptions) {
                options.filterOptions = {};
            }
            // il se peut que l'utilisateur ait surchargé ce paramètre dans geocodeOptions,
            if ( !options.filterOptions.type ) {
                options.filterOptions.type = resources;
            }
        }

        // cas où la clef API n'est pas renseignée dans les options du service,
        // on utilise celle de l'autoconf ou celle renseignée au niveau du controle
        options.apiKey = options.apiKey || this.options.apiKey;

        logger.log(options);

        Gp.Services.autoComplete(options);
    };

    /**
     * this method is called by this.onAutoCompleteSearchText() (case of success)
     * and fills the container of the location list.
     * it creates a HTML Element per location
     *
     * @private
     */
    SearchEngine.prototype._fillAutoCompletedLocationListContainer = function (locations) {

        if (!locations || locations.length === 0) {
            return;
        }

        // on vide la liste avant de la construire
        var element = this._suggestedContainer;
        if (element.childElementCount) {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        }

        this._displaySuggestedLocation();
        for (var i = 0; i < locations.length; i++) {
            // Proposals are dynamically filled in Javascript by autocomplete service
            this._createAutoCompletedLocationElement(locations[i], i);
        }

        // sauvegarde de l'etat des locations
        this._suggestedLocations = locations;
    };

    /**
     * this method is called by this.onAutoCompleteSearch()
     * and executes a request to the service.
     *
     * @param {Object} settings - service settings
     * @param {String}   settings.location - text
     * @param {Function} settings.onSuccess - callback
     * @param {Function} settings.onFailure - callback
     * @private
     */
    SearchEngine.prototype._requestGeocoding = function (settings) {

        // on ne fait pas de requête si on n'a pas renseigné de parametres !
        if (!settings || ( typeof settings === "object" && Object.keys(settings).length === 0 ) ) {
            return;
        }

        // on ne fait pas de requête si la parametre 'text' est vide !
        if (!settings.location) {
            return;
        }

        logger.log(settings);

        var options = {};
        options.returnFreeForm = true;
        // on recupere les options du service
        Utils.assign(options, this.options.geocodeOptions);
        // ainsi que la recherche et les callbacks
        Utils.assign(options, settings);

        // on ajoute le paramètre filterOptions.type spécifiant les ressources.
        var resources = this.options.resources.geocode;
        if (resources && Array.isArray(resources) ) {
            if (! options.filterOptions) {
                options.filterOptions = {};
            }
            // il se peut que l'utilisateur ait surchargé ce paramètre dans geocodeOptions,
            // ou qu'il ait déjà été rempli (cas de la recherche avancée)
            if ( !options.filterOptions.type ) {
                options.filterOptions.type = resources;
            }
        }

        // cas où la clef API n'est pas renseignée dans les options du service,
        // on utilise celle de l'autoconf ou celle renseignée au niveau du controle
        options.apiKey = options.apiKey || this.options.apiKey;

        logger.log(options);

        Gp.Services.geocode(options);
    };

    /**
     * this method is called by this.onGeocodingSearch()
     * and fills the container of the location results.
     * it creates a HTML Element per location
     * (cf. this. ...)
     *
     * @private
     */
    SearchEngine.prototype._fillGeocodedLocationListContainer = function (locations) {

        if (!locations || locations.length === 0) {
            this._clearGeocodedLocation();
            return;
        }

        // on vide la liste avant de la construire
        var element = this._geocodedContainer;
        if (element.childElementCount) {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        }

        for (var i = 0; i < locations.length; i++) {
            logger.log(locations[i]);
            // Proposals are dynamically filled in Javascript by autocomplete service
            this._createGeocodedLocationElement(locations[i], i);
        }

        // sauvegarde de l'etat des locations
        this._geocodedLocations = locations;
    };

    // ################################################################### //
    // ######################### other methods ########################### //
    // ################################################################### //

    /**
     * this sends the label to the panel.
     *
     * @param {String} label - label suggested location
     * @private
     */
    SearchEngine.prototype._setLabel = function (label) {
        document.getElementById("GPsearchInputText-" + this._uid).value = label;
    };

    /**
     * this method is called by this.on*ResultsItemClick()
     * and move/zoom on a position.
     *
     * @param {Array} position - ol.Coordinate object [lon, lat] (en lat/lon : "EPSG:4326")
     * @param {Number} zoom - zoom level
     * @private
     */
    SearchEngine.prototype._setPosition = function (position, zoom) {

        var view = this.getMap().getView();
        console.log(position);
        view.setCenter(position);
        view.setZoom(zoom);

    };

    /**
     * this method is called by this.on*ResultsItemClick()
     * and displays a marker.
     * FIXME
     *
     * @param {Array} position - ol.Coordinate object [lon, lat] ou [x, y]
     * @private
     */
    SearchEngine.prototype._setMarker = function (position, info) {

        var map = this.getMap();
        var context = this;

        // remove previous markers
        if (this._marker != null) {
            map.removeOverlay(this._marker);
            this._marker = null;
        }

        if (position) {

            // création de l'élément DOM
            var markerDiv = document.createElement("img");
            markerDiv.src = this._markerUrl;

            // ajout de l'évènement onclick (pour afficher une popup)
            if ( markerDiv.addEventListener ) {
                markerDiv.addEventListener(
                    "click",
                    function () {
                        context._onResultMarkerSelect(info);
                    }
                );
            } else if ( markerDiv.attachEvent ) {
                // Internet Explorer
                markerDiv.attachEvent(
                    "onclick",
                    function () {
                        context._onResultMarkerSelect(info);
                    }
                );
            }

            // création du marker (overlay)
            this._marker = new ol.Overlay({
                position : position,
                offset : [-25.5, -38],
                element : markerDiv,
                stopEvent : false
            });
            map.addOverlay(this._marker);
        }
    };

    /**
     * this method is called by this.on*ResultsItemClick()
     * and get zoom to results.
     *
     * @param {Object} info - {}
     * @private
     */
    SearchEngine.prototype._getZoom = function (info) {

        var map  = this.getMap();
        var key  = this.options.zoomTo;
        var zoom = null;

        // les valeurs du zooms sont determinées
        // soit par les mots clefs suivants :  max, min ou auto
        // soit par un niveau de zoom
        // soit defini par l'utilisateur via une fonction

        if ( typeof key === "function" ) {
            logger.trace("zoom function");
            zoom = key.call(this, info);
        }

        if ( typeof key === "number" ) {
            logger.trace("zoom level");
            zoom = key;
        }

        if ( typeof key === "string") {

            // if (key === "max") {
            //     zoom = map.getMaxZoom();
            // } else if (key === "min") {
            //     zoom = map.getMinZoom();
            // } else

            if (key === "auto") {
                logger.trace("zoom auto");
                zoom = SearchEngineUtils.zoomToResultsByDefault(info);

            } else {
                logger.trace("zoom level parsing");
                var value = parseInt(key, 10);
                if (!isNaN(value)) {
                    logger.trace("zoom parsing");
                    zoom = value;
                }
            }
        }

        // polyfill IE
        Number.isInteger = Number.isInteger || function (value) {
            return typeof value === "number" &&
                   isFinite(value) &&
                   Math.floor(value) === value;
        };

        // test de validité du zoom,
        // on prend le zoom courant par defaut ...
        if (!zoom || zoom === "" || !Number.isInteger(zoom)) {
            logger.trace("zoom not found, current zoom...");
            zoom = map.getView().getZoom();
        }

        // FIXME test si le zoom est dans l'espace de la carte
        var min = map.minZoom; // .getMinZoom();
        var max = map.maxZoom; // .getMaxZoom();
        if (zoom < min) {
            logger.trace("zoom level min...");
            zoom = min;
        }
        if (zoom > max) {
            logger.trace("zoom level max...");
            zoom = max;
        }

        logger.trace("zoom", zoom);
        return zoom;
    };

    /**
     * this method is called on 'click' on this._marker
     * (cf. this._setMarker() )
     * and sets a popup with marker information
     *
     * @param {Object} information - location information
     * @private
     */
    SearchEngine.prototype._onResultMarkerSelect = function (information) {
        var map = this.getMap();

        var popupContent = "";
        if ( information.attributes ) {
            // si on a des attributes (freeform = false)
            popupContent = "<ul>";
            var attributes = information.attributes;
            for ( var attr in attributes ) {
                if ( attributes.hasOwnProperty(attr) ) {
                    if ( attr !== "bbox" ) {
                        popupContent += "<li>";
                        popupContent += "<span class=\"gp-attname-others-span\">" + attr.toUpperCase() + " : </span>";
                        popupContent += attributes[attr];
                        popupContent += " </li>";
                    }
                }
            }
            popupContent += " </ul>";
        } else {
            // freeform
            popupContent = information.label;
        }

        this._popupContent.innerHTML = popupContent;
        if ( !this._popupOverlay ) {
            // ajout de la popup a la carte comme un overlay
            this._popupOverlay = new ol.Overlay({
                element : this._popupDiv,
                positioning : "bottom-center",
                position : this._marker.getPosition(),
                offset : [0, -42]
            });
            map.addOverlay(this._popupOverlay);
        } else {
            // si l'overlay est déjà créé, on modifie juste sa position
            this._popupOverlay.setPosition(this._marker.getPosition());
        }

    };

    // ################################################################### //
    // ###################### other handlers events ###################### //
    // ################################################################### //

    /**
     * this method is called by event 'click' on 'GPshowSearchEnginePicto' tag label
     * (cf. this._createShowSearchEnginePictoElement), and it cleans the component
     * when it's closed.
     *
     * @private
     */
    SearchEngine.prototype.onShowSearchEngineClick = function () {
        this.collapsed = this._showSearchEngineInput.checked;
        // on génère nous même l'evenement OpenLayers de changement de propriété
        // (utiliser ol.control.SearchEngine.on("change:collapsed", function ) pour s'abonner à cet évènement)
        this.dispatchEvent("change:collapsed");
    };

    /**
     * this method is called by event 'click' on 'GPsearchInputReset' tag div
     * (cf. this._createSearchInputElement), and it cleans the value of input.
     *
     * @private
     */
    SearchEngine.prototype.onSearchResetClick = function () {
        this._clearResults();
    };

    // ################################################################### //
    // ################## handlers events AutoComplete ################### //
    // ################################################################### //

    /**
     * this method is called by event 'click' on 'GPlocationOrigin' input
     *
     * @private
     */
    SearchEngine.prototype.onAutoCompleteInputClick = function () {
        var inputSearchTextContainer = document.getElementById("GPsearchInputText-" + this._uid);
        if ( inputSearchTextContainer && !inputSearchTextContainer.disabled && inputSearchTextContainer.value.length > 2) {
            this._displaySuggestedLocation();
        }
    };

    /**
     * this method is called by event 'keyup' on 'GPsearchInputText' tag input
     * (cf. this._createSearchInputElement), and it gets the value of input.
     * this value is passed as a parameter for the service autocomplete (text).
     * the results of the request are displayed into a drop down menu.
     *
     * @param {Object} e - HTMLElement
     * @private
     */
    SearchEngine.prototype.onAutoCompleteSearchText = function (e) {

        var value = e.target.value;
        if (!value) {
            return;
        }

        // aucun droits !
        // on evite une requête...
        if (this._noRightManagement) {
            console.log("no rights for this service !");
            return;
        }

        // on sauvegarde le localisant
        this._currentGeocodingLocation = value;

        // on limite les requêtes à partir de 3 car. saisie !
        if (value.length < 3) {
            this._clearSuggestedLocation();
            return;
        }

        // INFORMATION
        // on effectue la requête au service d'autocompletion.
        // on met en place des callbacks afin de recuperer les resultats ou
        // les messages d'erreurs du service.
        // les resultats sont affichés dans une liste deroulante.
        // les messages d'erreurs sont affichés sur la console (?)
        var context = this;
        this._requestAutoComplete({
            text : value,
            /** callback onSuccess */
            onSuccess : function (results) {
                logger.log(results);
                if (results) {
                    var locations = results.suggestedLocations;
                    context._fillAutoCompletedLocationListContainer(locations);
                }
            },
            /** callback onFailure */
            onFailure : function (error) {
                // FIXME
                // où affiche t on les messages : ex. 'No suggestion matching the search' ?
                // doit on nettoyer la liste des suggestions dernierement enregistrée :
                context._clearSuggestedLocation();
                logger.log(error.message);
            }
        });

        var map = this.getMap();
        map.on(
            "click",
            this._hideSuggestedLocation,
            this
        );
        map.on(
            "pointerdrag",
            this._hideSuggestedLocation,
            this
        );
    };

    /**
     * this method is called by event 'click' on 'GPautoCompleteResultsList' tag div
     * (cf. this._createAutoCompleteListElement), and it selects the location.
     * this location displays a marker on the map.
     *
     * @param {Object} e - HTMLElement
     * @private
     */
    SearchEngine.prototype.onAutoCompletedResultsItemClick = function (e) {

        // TODO on souhaite un comportement different pour la selection des reponses
        // de l'autocompletion :
        // - liste deroulante des reponses,
        // - puis possibilité de cliquer sur une suggestion
        // - mais aussi de la choisir avec le clavier (arrow up/down), puis valider
        // par un return
        // cette selection avec les fleches doit mettre à jour le input !
        // (comme un moteur de recherche de navigateur)

        var idx = SelectorID.index(e.target.id);
        logger.log(idx);
        logger.log(this._suggestedLocations[idx]);

        if (!idx) {
            return;
        }

        var position = [
            this._suggestedLocations[idx].position.x,
            this._suggestedLocations[idx].position.y
        ];
        var info = {
            service : "SuggestedLocation",
            type : this._suggestedLocations[idx].type,
            fields : this._suggestedLocations[idx]
        };

        // on ajoute le texte de l'autocomplétion dans l'input
        var label = this._suggestedLocations[idx].fullText;
        this._setLabel(label);
        info.label = label;

        // Info : la position est en EPSG:4326, à transformer dans la projection de la carte
        var view = this.getMap().getView();
        var mapProj = view.getProjection().getCode();
        if ( mapProj !== "EPSG:4326" ) {
            // on retransforme les coordonnées de la position dans la projection de la carte
            position = ol.proj.transform(position, "EPSG:4326", mapProj);
        }
        // on centre la vue et positionne le marker, à la position reprojetée dans la projection de la carte
        var zoom = this._getZoom(info);
        this._setPosition(position, zoom);
        this._setMarker(position, info);
    };

    // ################################################################### //
    // ################### handlers events Geocode ####################### //
    // ################################################################### //

    /**
     * this method is called by event 'submit' on 'GPsearchInput' tag form
     * (cf. this._createSearchInputElement), and it gets the value of input.
     * this value is passed as a parameter for the service geocoding.
     * the results of the request are displayed into a window.
     *
     * @param {Object} e - HTMLElement
     * @private
     */
    SearchEngine.prototype.onGeocodingSearchSubmit = function (e) {

        var value = e.target[0].value;
        if (!value) {
            return;
        }

        // aucun droits !
        // on evite une requête...
        if (this._noRightManagement) {
            console.log("no rights for this service !");
            return;
        }

        // on sauvegarde le localisant
        this._currentGeocodingLocation = value;

        // on met en place l'affichage des resultats dans une fenetre de recherche.
        var context = this;
        this._requestGeocoding({
            location : value,
            /** callback onSuccess */
            onSuccess : function (results) {
                logger.log(results);
                if (results) {
                    var locations = results.locations;
                    context._fillGeocodedLocationListContainer(locations);
                }
            },
            /** callback onFailure */
            onFailure : function (error) {
                // FIXME cf. this.onAutoCompleteSearch()
                context._clearGeocodedLocation();
                logger.log(error.message);
            }
        });

    };

    /**
     * this method is called by event 'submit' on 'GPgeocodeResultsList' tag div
     * (cf. this._createGeocodeResultsListElement), and it selects the location.
     * this location displays a marker on the map.
     *
     * @param {Object} e - HTMLElement
     * @private
     */
    SearchEngine.prototype.onGeocodedResultsItemClick = function (e) {
        var idx = SelectorID.index(e.target.id);

        if (!idx) {
            return;
        }

        var position = [
            this._geocodedLocations[idx].position.y,
            this._geocodedLocations[idx].position.x
        ];
        var attributes = this._geocodedLocations[idx].placeAttributes;
        var info = {
            service : "DirectGeocodedLocation",
            type : this._geocodedLocations[idx].type,
            fields : this._geocodedLocations[idx]
        };

        // on ajoute le texte du géocodage dans l'input
        var label;
        if ( attributes.freeform ) {
            // reponse en freeForm
            label = attributes.freeform;
        } else if ( attributes.postalCode ) {
            // cas des StreetAddress, PositionOfInterest, Administratif
            // on affiche uniquement ce qui est commun aux ressources ...
            label = attributes.postalCode + " " + attributes.commune;
            info.attributes = attributes;
        } else if ( attributes.cadastralParcel ) {
            // cas des CadastralParcel
            label = attributes.cadastralParcel;
            info.attributes = attributes;
        } else {
            label = "...";
        }
        this._setLabel(label);
        info.label = label;

        // Info : la position est en EPSG:4326, à transformer dans la projection de la carte
        var view = this.getMap().getView();
        var mapProj = view.getProjection().getCode();
        if ( mapProj !== "EPSG:4326" ) {
            // on retransforme les coordonnées de la position dans la projection de la carte
            position = ol.proj.transform(position, "EPSG:4326", mapProj);
        }
        // on centre la vue et positionne le marker, à la position reprojetée dans la projection de la carte
        var zoom = this._getZoom(info);
        this._setPosition(position, zoom);
        this._setMarker(position, info);
    };

    // ################################################################### //
    // ############## handlers events Geocode Advanced ################### //
    // ################################################################### //

    /**
     * this method is called by event 'change' on 'GPadvancedSearchCode' tag select
     * (cf. this._createAdvancedSearchFormCodeElement), and it gets the value of
     * option selected.
     * this value is passed as a parameter to create the attributs container.
     *
     * @param {Object} e - HTMLElement
     * @private
     */
    SearchEngine.prototype.onGeocodingAdvancedSearchCodeChange = function (e) {
        logger.log(e);
        var idx   = e.target.selectedIndex;
        var value = e.target.options[idx].value;

        if (!value) {
            return;
        }

        // INFORMATION
        // le declenchement de l'evenement va creer un container de filtre à la volée...
        // l'insertion des containers d'attributs dans le DOM sont :
        // - soit GPadvancedSearchFilters > PositionOfInterest
        // - soit GPadvancedSearchFilters > StreetAddress
        // - soit GPadvancedSearchFilters > CadastralParcel
        // cf. _setFilter() pour la creation du container

        this._setFilter(value);
    };

    /**
     * this method is called by event 'submit' on 'GPadvancedSearchForm' tag form
     * (cf. this._createAdvancedSearchPanelFormElement), and it gets the value of all input.
     * this value is passed as a parameter for the service geocoding.
     * the results of the request are displayed into a window.
     *
     * @param {Object} e - HTMLElement
     * @param {Array} data - [{key: ..., value: ...}]
     * @private
     */
    SearchEngine.prototype.onGeocodingAdvancedSearchSubmit = function (e, data) {
        logger.log(data);
        if (!data || data.length === 0) {
            return;
        }

        var _location;
        var _filterOptions = {};
        var filter;
        _filterOptions.type = [this._currentGeocodingCode];
        for ( var i = 0; i < data.length; i++ ) {
            filter = data[i];
            _filterOptions[filter.key] = filter.value;
        }

        if ( this._currentGeocodingCode === "CadastralParcel" ) {
            // dans ce cas, les filtres de recherche avancée ne sont pas vraiment des filtres,
            // mais simplement la décomposition des informations de la parcelle, à concaténer.
            _location = this._getCadastralParcelRequestParams(_filterOptions);

            // FIXME ne marche pas bien !
            _filterOptions = {
                type : [this._currentGeocodingCode]
            };

        } else {
            // recuperation des parametres des filtres pour les transmettre
            // à la requête, ainsi que le type de table de ressources de geocodage,
            // et le localisant (freeform)
            _location = this._currentGeocodingLocation;
        }

        // on met en place l'affichage des resultats dans une fenetre de recherche.
        var context = this;
        this._requestGeocoding({
            location : _location,
            filterOptions : _filterOptions,
            /** callback onSuccess */
            onSuccess : function (results) {
                logger.log(results);
                if (results) {
                    var locations = results.locations;
                    context._fillGeocodedLocationListContainer(locations);
                }
            },
            /** callback onFailure */
            onFailure : function (error) {
                // FIXME cf. this.onAutoCompleteSearch()
                context._clearGeocodedLocation();
                logger.log(error.message);
            }
        });
    };

    /**
     * this method is called by 'onGeocodingAdvancedSearchSubmit' method,
     * in case geocoding type is 'CadastralParcel',
     * and gets request parameters from inputs
     *
     * @param {Object} filterOptions - object with inputs value (department, insee, ...)
     * @returns {String} location - cadastral parcel number : concatenation of inputs values (e.g. : 940670000D0041 or 94067_____0041)
     * @private
     */
    SearchEngine.prototype._getCadastralParcelRequestParams = function ( filterOptions ) {
        /* info:
            la parcelle cadastrale se compose de 14 chiffres ou lettres, indiquant, de gauche à droite :
            - le code du département (2 caractères)
            - le code commune (3 caractères). (Remarque : code département + code commune = code INSEE)
            - OU le code INSEE de la commune (5 chiffres) (remplace les 2 précédents)
            - le code commune absorbée INSEE, ou '000' (3 caractères),
            - la section (2 caractères),
            - le numéro de parcelle (4 caractères).
            Exemple de parcelle : '940670000D0041'. Si l'identifiant est incomplet (par exemple '940670000D'), le service renverra uniquement les 25 premiers résultats pouvant correspondre.
        */

        var _location = "";

        var l;
        // code département (2 caractères)
        var dep = filterOptions.department;
        if ( dep ) {
            l = dep.length;
            if ( l === 2 ) {
                _location = dep;
            } else if ( l === 1 ) {
                // si un seul numéro a été saisi, on présume que c'est un numéro < 10
                _location = "0" + dep;
            } else {
                _location = dep.substring(0,2);
            }
        } else {
            _location = "__";
        }

        // code commune insee (3 caractères)
        var commune = filterOptions.commune;
        if ( commune ) {
            l = commune.length;
            if ( l === 3 ) {
                _location += commune;
            } else if ( l == 2 ) {
                _location += "_" + commune;
            } else if ( l == 1 ) {
                _location += "__" + commune;
            } else { // l > 3
                _location += commune.substring(0,3);
            }
        } else {
            _location += "___";
        }

        // code insee (5 caractères) : surcharge les 2 autres si renseigné
        var insee = filterOptions.insee;
        if ( insee ) {
            if ( insee.length === 5 ) {
                _location = insee;
            }
        }

        // code commune absorbee INSEE (3 caractères)
        var absorbedCity = filterOptions.absorbedCity;
        if ( absorbedCity ) {
            l = absorbedCity.length;
            if ( l === 3 ) {
                _location += absorbedCity;
            } else if ( l < 3 ) {
                if ( l === 2 ) {
                    _location += "_" + absorbedCity;
                } else if ( l === 1 ) {
                    _location += "__" + absorbedCity;
                }
            } else { // l > 3
                _location += absorbedCity.substring(0,3);
            }
        } else {
            _location += "___";
        }

        // section (2 caractères)
        var section = filterOptions.section;
        if ( section ) {
            l = section.length;
            if ( l === 2 ) {
                _location += section;
            } else if ( l === 1) {
                _location += "_" + section;
            } else {
                _location += section.substring(0,2);
            }
        } else {
            _location += "__";
        }

        // numéro de parcelle (4 caractères)
        var number = filterOptions.number;
        if ( number ) {
            l = number.length;
            if ( l === 4 ) {
                _location += number;
            } else if ( l === 3 ) {
                _location += "_" + number;
            } else if ( l === 2 ) {
                _location += "__" + number;
            } else if ( l === 1 ) {
                _location += "___" + number;
            } else { // l > 4
                _location += number.substring(0,4);
            }
        } else {
            _location += "___";
        }

        logger.log("location : " + _location);

        return _location;
    };

    // ################################################################### //
    // ############################## clean ############################## //
    // ################################################################### //

    /**
     * this method is called by this.onSearchReset()
     * and it clears all results and the marker.
     *
     * @private
     */
    SearchEngine.prototype._clearResults = function () {

        var map = this.getMap();

        this._currentGeocodingLocation = null;

        this._clearSuggestedLocation();
        this._clearGeocodedLocation();

        this._setMarker();
        // on retire l'overlay de la popup de la carte
        if ( this._popupOverlay != null ) {
            map.removeOverlay(this._popupOverlay);
            this._popupOverlay = null;
        }
    };

    /**
     * this method is called by this.onAutoCompleteSearchText()
     * and it clears all suggested location.
     *
     * @private
     */
    SearchEngine.prototype._clearSuggestedLocation = function () {
        this._suggestedLocations = [];
        if (this._suggestedContainer) {
            while (this._suggestedContainer.firstChild) {
                this._suggestedContainer.removeChild(this._suggestedContainer.firstChild);
            }
        }
    };

    /**
     * this method is called by event 'click' on map
     * and it hides suggested locations
     *
     * @private
     */
    SearchEngine.prototype._hideSuggestedLocation = function () {
        if (this._autocompleteContainer) {
            this._autocompleteContainer.style.display = "none";
        }
    };

    /**
     * this method is called by event 'click' on label input
     * and it displays suggested location.
     *
     * @private
     */
    SearchEngine.prototype._displaySuggestedLocation = function () {
        if ( this._autocompleteContainer ) {
            this._autocompleteContainer.style.display = "block";
        }
    };

    /**
     * this method is called by this.onGeocodingAdvancedSearchSubmit()
     * and it clears all geocoded location.
     *
     * @private
     */
    SearchEngine.prototype._clearGeocodedLocation = function () {
        this._geocodedLocations = [];
        if (this._geocodedContainer) {
            while (this._geocodedContainer.firstChild) {
                this._geocodedContainer.removeChild(this._geocodedContainer.firstChild);
            }
        }
    };

    return SearchEngine;
});
