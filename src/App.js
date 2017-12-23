
Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',

    config: {
        defaultSettings: {
			// The time period to report on.
        	period : "month",
            // number of periods to report on.
            periods : "6",
            // if true we read the context project and all of its subprojects using the wsapi.
            // this is useful where the hierarchy is reoorganized and we dont have snapshots for the 
            // new hierarchy eg. you add a top level node. However it will be slower, especially in 
            // large hierarchies
            wsapiProjects : false
        }
    },

	launch: function() {

		var that = this;

		// rally functions is a collection of utility functions 
		// including a recursive object read
        that.rallyFunctions = Ext.create("RallyFunctions",{ 
            ctx : that.getContext(),
        	keys : ['projects']
        });


		that.periods = that.createTimePeriodRanges();

		if ( that.getSetting("wsapiProjects")==true) {
			that.readSubProjects(function(list){
				that.subProjects = list;
	            that.createChart();	
	        });
		} else {
			that.createChart();	
		}
		
	},

	readSubProjects : function(callback) {
		var that = this;

        that.rallyFunctions._loadAStoreWithAPromise(
        	"Project",
        	["ObjectID","Parent","Name","Children"],
        	[ { property:"ObjectID", operator:"=", value:that.getContext().getProject().ObjectID } ]
    	).then({
            scope: that,
            success: function(projects) {
            
            	console.log("Current Project:",projects);
				that.rallyFunctions.recurseObject(_.first(projects))
					.then({

						success : function(list) {
							console.log("success",list);
							callback(list);
						},
						failure : function(err) {
							console.log("error",err);
						}
				})
            }
        });
	},

	dateFormats : {
		"hour" : "hh A",
		"day" : "ddd",
		"week" : "ddd MMM DD",
		"month" : "YYYY MMMM ",
		"quarter" : "Qo YYYY",
		"year" : "YYYY"
	},

	createTimePeriodRanges : function() {
		var that = this;
		var date = new Date();
		var mArray = [];
		console.log("periods",that.getSetting("periods"));
		var period = that.getSetting("period");
		console.log("period",period);

		for(x=0; x < parseInt(that.getSetting("periods")); x++) {
			var first = moment(date).subtract(x,period + "s").startOf(period);
			var last = moment(date).subtract(x,period + "s").endOf(period);
			mArray.push({
				label : last.format(that.dateFormats[period]),
				first : first.toISOString(),
				last : last.toISOString()
			})
		}
		mArray.reverse();
		console.log("periods",mArray);
		return mArray;
	},

	createChart: function (projects) {

		var that = this;

		var configs = _.map(that.periods,function(m) {

			console.log("m.first",m.first,"m.last",m.last);
            var find = {
                "$and" : [{"_ValidFrom": {"$gte" : m.first}}, {"_ValidFrom":{"$lte" : m.last }}]
            }

            if (that.getSetting("wsapiProjects")==false) {
                find['_ProjectHierarchy'] = that.getContext().getProject().ObjectID
            } else {
                find['Project'] = { "$in" :
                    _.map( that.subProjects,function( p ) { 
                        return p.get("ObjectID")})
                }
            }

            console.log("find",find);

			return  {
				find : find,
				fetch: ['_ValidFrom','_TypeHierarchy'],
				hydrate: ['_TypeHierarchy']
			}
		});

		async.map( configs, that.snapshotQuery, function(err,results) {
			console.log(results);
			that.add(that.createExtChart(results));
		} );
	},

	createExtChart : function(results) {
		var that = this;

		// convert the arrays of data into a json format for jston store 
		var data = _.map(results, function(data,i) {
			return {
				month : that.periods[i].label,
				count : (data)
			};
		});

		// create the store
		var chartStore = Ext.create('Ext.data.JsonStore', {
			fields: ['month','count'],
			data: data
		});

		var chart = new Ext.chart.Chart({
			width: that.getWidth(),
			height: that.getHeight(),
			animate: true,
			store: chartStore,
			// renderTo: Ext.getBody(),
			shadow: true,
			axes: [{
				type: 'Numeric',
				position: 'left',
				fields: ['count'],
				label: {
					renderer: Ext.util.Format.numberRenderer('0,0')
				},
				title: 'Count',
				grid: true,
				minimum: 0
			}, {
				type: 'Category',
				position: 'bottom',
				fields: ['month'],
				title: 'Month',
				label : {
					rotate: {
	     				degrees: 45
	    			}
	    		},
			}],
			series: [{
				type: 'column',
				axis: 'bottom',
				highlight: true,
				xField: 'month',
				yField: 'count',
				label : {
					field : 'count',
					display : 'rotate'

				}
				// tooltip: {
    //                 // trackMouse: true,
    //                 renderer: function(tip, item) {
    //                     tip.setTitle(item.get('month'));
    //                     tip.update('Count: ' + item.get('count'));
    //                 }
    //             }
			}]
		});

		return chart;

	},

	snapshotQuery : function( config, callback ) {

		Ext.create('Rally.data.lookback.SnapshotStore', {
			find : config.find,
			useHttpPost : true,
			autoLoad : true,
			limit : 10,
			fetch : config.fetch,
			hydrate : config.hydrate,
			pageSize: 10,

			listeners : {
				scope : this,
				load: function(store, snapshots, success) {
					console.log("Loaded:"+snapshots.length," Snapshots.");
					console.log("Store",store);
					// callback(null,snapshots);
					callback(null,store.totalCount);
				}
			}
		});
		
	},

    getSettingsFields: function() {
        var me = this;

        var granularityStore = new Ext.data.ArrayStore({
            fields: ['granularity'],
            data : [['hour'],['day'],['week'],['month'],['quarter'],['year']]
        });  

		return [
		{
            name: 'period',
            xtype: 'combo',
            store : granularityStore,
            valueField : 'granularity',
            displayField : 'granularity',
            queryMode : 'local',
            forceSelection : true,
            boxLabelAlign: 'after',
            fieldLabel: 'Period Type',
            margin: '0 0 15 50',
            labelStyle : "width:200px;",
            afterLabelTpl: 'Select the time period to report on'
		},
		 {
            name: 'periods',
            xtype: 'rallytextfield',
            boxLabelAlign: 'after',
            fieldLabel: '# Time periods',
            margin: '0 0 15 50',
            labelStyle : "width:200px;",
            afterLabelTpl: 'The number of time periods to report on.'
        },{
            name: 'wsapiProjects',
            xtype: 'rallycheckboxfield',
            boxLabelAlign: 'after',
            fieldLabel: 'True to read projects using wsapi',
            margin: '0 0 15 50',
            labelStyle : "width:200px;",
            afterLabelTpl: 'otherwise will use the lbapi project scoping'
        }];
    }

});
