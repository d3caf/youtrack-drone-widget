import 'babel-polyfill';
import DashboardAddons from 'hub-dashboard-addons';
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {render} from 'react-dom';
import Input from '@jetbrains/ring-ui/components/input/input';
import Group from '@jetbrains/ring-ui/components/group/group';
import Panel from '@jetbrains/ring-ui/components/panel/panel';
import Button from '@jetbrains/ring-ui/components/button/button';
import ContentLayout from '@jetbrains/ring-ui/components/content-layout/content-layout';
import { CheckmarkIcon, CloseIcon, BranchesIcon, HourglassIcon } from '@jetbrains/ring-ui/components/icon';

import _orderBy from 'lodash/orderBy';
import { distanceInWordsToNow, parse } from 'date-fns';

import 'file-loader?name=[name].[ext]!../../manifest.json'; // eslint-disable-line import/no-unresolved
import styles from './app.css';

class Widget extends Component {

  static propTypes = {
    dashboardApi: PropTypes.object,
    registerWidgetApi: PropTypes.func
  };

  constructor(props) {
    super(props);
    const {registerWidgetApi, dashboardApi} = props;

    this.state = {
      isConfiguring: false,
      apiKey: null,
      droneUrl: null,
      deploys: [],
    };

    registerWidgetApi({
      onConfigure: () => this.setState({isConfiguring: true}),
      onRefresh: () => this._fetch()
    });

    this.initialize(dashboardApi);
  }

  componentDidMount() {
    const refreshTimer = window.setInterval(() => {this._fetch()}, 300000);
  }

  componentWillUnmount() {
    clearTimeout(refreshTimer);
  }

  initialize(dashboardApi) {
    dashboardApi.readConfig().then(config => {
      if (!config) {
        return;
      }
      this.setState({apiKey: config.apiKey, droneUrl: config.droneUrl}, () => {
        if(this.state.apiKey && this.state.droneUrl) {
          this._fetch();
        }
      });
    });
  }

  saveConfig = async () => {
    const {apiKey, droneUrl} = this.state;
    await this.props.dashboardApi.storeConfig({apiKey, droneUrl});
    this.setState({isConfiguring: false});
  };

  cancelConfig = async () => {
    this.setState({isConfiguring: false});
    await this.props.dashboardApi.exitConfigMode();
    this.initialize(this.props.dashboardApi);
  };

  _fetch = () => {
    this.props.dashboardApi.setLoadingAnimationEnabled(true); 

    return fetch(`${this.state.droneUrl}/api/user/feed?latest=true`, {
      headers: new Headers({
        'Authorization': `Bearer ${this.state.apiKey}`
      })
    }).then(res => {
      return res.ok ? res.json() : new Error(res);
    }).then(deploys => {
      this.prepareData(deploys);
      this.props.dashboardApi.setLoadingAnimationEnabled(false); 
    }).catch(err => console.warn(err))
  };

  prepareData = data => {
    const sorted = _orderBy(data, i => i.started_at || '', ['desc']);

    this.setState({deploys: sorted});
  }

  onTextInputChange = e => {
    const { name, value } = e.target;
    switch (name) { 
      case 'apiKey': 
        this.setState({
          apiKey: value
        });
        break;
      case 'droneUrl': 
        this.setState({
          droneUrl: value
        });
        break;
      default:
        return false;
    }
  }

  renderConfiguration() {
    const {apiKey, droneUrl} = this.state;

    return (
      <div className={styles.widget}>
        <div className="inputGroup">
          <label htmlFor="apiKey">API Key</label>
          <Input name="apiKey" value={apiKey} onChange={this.onTextInputChange} />
        </div>

        <div className="inputGroup">
          <label htmlFor="droneUrl">Drone URL</label>
          <Input name="droneUrl" value={droneUrl} onChange={this.onTextInputChange} />
        </div>

        <Panel>
          <Button blue={true} onClick={this.saveConfig}>{'Save'}</Button>
          <Button onClick={this.cancelConfig}>{'Cancel'}</Button>
        </Panel>
      </div>
    );
  }

  render() {
    const {isConfiguring, droneUrl} = this.state;

    if (isConfiguring) {
      return this.renderConfiguration();
    }

    return (
      <ContentLayout>
        {this.state.apiKey && this.state.droneUrl ? (
          this.state.deploys && (
            <ul className={styles.deployList}>
             {this.state.deploys.map((deploy, key) => (
              <li key={key}>
                <div className="icon" style={{marginRight: '1rem'}}>
                  {deploy.status === 'success' && (
                    <CheckmarkIcon color="green" size={CheckmarkIcon.Size.Size14} />
                  )} 
                  
                  {deploy.status === 'running' && (<HourglassIcon color="green" size={HourglassIcon.Size.Size14} />)}
                  {deploy.status !== 'running' && deploy.status !== 'success' && (<CloseIcon color="red" size={CloseIcon.Size.Size14} />)}
                </div>
                <div className="info" style={{flex: '1 1 auto'}}>
                  <div className="row">
                    <span className={styles.title} style={{flex: 1}}><a target="_blank" href={deploy.number ? `${this.state.droneUrl}/${deploy.full_name}/${deploy.number}` : null}>{deploy.name}</a> {deploy.started_at && (<small style={{color: "#b2b2b2"}}>{distanceInWordsToNow(parse(deploy.started_at * 1000), {addSuffix: true, includeSeconds: true})}</small>)}</span>
                    <span className="hash" style={{flex: '0 1 auto'}}>
                      {deploy.commit ? <span><BranchesIcon color="#f1f1f1" size={BranchesIcon.Size.Size12} /> <a href={`${deploy.remote.slice(0, -4)}/tree/${deploy.branch}`} target="_blank">{deploy.branch}</a> - {deploy.commit.slice(0,6)}</span> : null}
                    </span>
                  </div>
                  <div className="row">
                    <p className={styles.description}>{deploy.message}</p> 
                  </div>
                </div>
              </li>
              ))}
            </ul>
            )
        ) : (<p style={{textAlign: 'center'}}>Enter your Drone API key and URL to see deployments.</p>)}
      </ContentLayout>
    );
  } }
DashboardAddons.registerWidget((dashboardApi, registerWidgetApi) => render( <Widget dashboardApi={dashboardApi} registerWidgetApi={registerWidgetApi} />, document.getElementById('app-container')
  )
);
